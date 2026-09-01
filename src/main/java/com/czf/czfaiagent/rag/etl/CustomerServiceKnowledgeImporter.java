package com.czf.czfaiagent.rag.etl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 增量导入本地客服知识文档。 */
@Component
@Slf4j
@ConditionalOnProperty(prefix = "ai.rag.local", name = "import-enabled", havingValue = "true")
public class CustomerServiceKnowledgeImporter implements ApplicationRunner {
    private final CustomerServiceDocumentLoader documentLoader;
    private final CustomerServiceDocumentManifestRepository manifestRepository;
    private final VectorStore vectorStore;

    public CustomerServiceKnowledgeImporter(CustomerServiceDocumentLoader documentLoader,
                                            CustomerServiceDocumentManifestRepository manifestRepository,
                                            @Qualifier("customerServiceLocalVectorStore") VectorStore vectorStore) {
        this.documentLoader = documentLoader;
        this.manifestRepository = manifestRepository;
        this.vectorStore = vectorStore;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("客服知识文档增量导入开始");
        List<CustomerServiceSourceDocument> sourceDocuments = documentLoader.loadMarkdowns();
        Map<String, CustomerServiceDocumentManifest> existing = new HashMap<>();
        manifestRepository.findAllActive().forEach(manifest -> existing.put(manifest.sourceId(), manifest));

        for (CustomerServiceSourceDocument source : sourceDocuments) {
            CustomerServiceDocumentManifest old = existing.remove(source.sourceId());
            if (old != null && old.contentHash().equals(source.contentHash())) {
                log.info("源文档未变化，跳过导入：{}", source.sourceId());
                continue;
            }
            if (old != null && !old.vectorIds().isEmpty()) {
                vectorStore.delete(old.vectorIds());
            }
            vectorStore.add(source.chunks());
            OffsetDateTime now = OffsetDateTime.now();
            manifestRepository.save(new CustomerServiceDocumentManifest(
                    source.sourceId(), source.contentHash(),
                    source.chunks().stream().map(doc -> doc.getId()).toList(),
                    source.chunks().size(), "ACTIVE",
                    old == null ? now : old.createdAt(), now));
            log.info("源文档导入完成：{}", source.sourceId());
        }

        OffsetDateTime now = OffsetDateTime.now();
        existing.values().forEach(old -> {
            if (!old.vectorIds().isEmpty()) {
                vectorStore.delete(old.vectorIds());
            }
            manifestRepository.markDeleted(old.sourceId(), now);
            log.info("源文档已删除，清理旧切片：{}", old.sourceId());
        });
    }
}
