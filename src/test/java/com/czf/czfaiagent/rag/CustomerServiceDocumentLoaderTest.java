package com.czf.czfaiagent.rag;

import com.czf.czfaiagent.rag.etl.CustomerServiceDocumentLoader;
import com.czf.czfaiagent.rag.etl.CustomerServiceSourceDocument;
import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;



class CustomerServiceDocumentLoaderTest {

    private final CustomerServiceDocumentLoader documentLoader =

            new CustomerServiceDocumentLoader(
                    // 使用 PathMatchingResourcePatternResolver 来加载本地 Markdown 文件
                    new PathMatchingResourcePatternResolver()
            );

    /**
     * 测试：
     * 1. 本地知识库路径必须至少加载出一个 Spring AI Document。
     * 2. Document 正文不能包含 Front Matter。
     * 3. 每个正文切片必须继承 Front Matter 元数据。
     * 4. 本地加载器不能加载云知识库文档。
     */
    @Test
    void shouldLoadLocalMarkdownDocuments() {
        List<CustomerServiceSourceDocument> sourceDocuments = documentLoader.loadMarkdowns();
        List<Document> documents = sourceDocuments.stream()
                .flatMap(source -> source.chunks().stream())
                .collect(Collectors.toList());

        // 1.本地知识库路径必须至少加载出一个 Spring AI Document。
        assertFalse(documents.isEmpty());

        // 2.当前 Document 的正文中不能包含 document_id:。
        boolean frontMatterExcluded = documents.stream()
                .noneMatch(document ->
                        document.getText().contains("document_id:")
                );

        assertTrue(frontMatterExcluded);

        // 3.每一个正文切片都应该继承原始 Markdown 的 Front Matter 元数据
        boolean frontMatterAttachedToMetadata = documents.stream()
                .allMatch(document ->
                        document.getMetadata().containsKey("document_id")
                                && document.getMetadata().containsKey("knowledge_source")
                                && document.getMetadata().containsKey("source_id")
                );
        boolean sourceIdMatchesDocumentId = documents.stream()
                .allMatch(document ->
                        Objects.equals(
                                document.getMetadata().get("document_id"),
                                document.getMetadata().get("source_id")
                        )
                );

        assertTrue(
                sourceIdMatchesDocumentId,
                "每个切片的 source_id 必须与 Front Matter 中的 document_id 一致"
        );



        assertTrue(
                frontMatterAttachedToMetadata,
                "每个切片都必须继承 document_id、knowledge_source、source_id 三项元数据"
        );

        // 4.每个切片都必须带有稳定的向量 ID。
        //    稳定 ID 的格式为「sourceId#chunk-N」，作用是实现幂等入库：
        //    应用重启后重新写入向量库时，相同 ID 会被更新（upsert）而不是重复插入，
        //    从而避免知识库数据无限膨胀。
        boolean vectorIdExists = documents.stream()
                .allMatch(document ->
                        document.getMetadata().containsKey("vector_id")
                                && document.getId().equals(
                                document.getMetadata().get("vector_id")
                        )
                );

        assertTrue(vectorIdExists);


        // 4.本地加载器不能加载计划由云知识库管理的作者公开信息
        boolean cloudKnowledgeExcluded = documents.stream()
                // 字符串.equals()避免空指针异常
                .noneMatch(document ->
                        "cloud-public-author-info".equals(
                                document.getMetadata().get("knowledge_source")
                        )
                );

        assertTrue(cloudKnowledgeExcluded);
    }

    /**
    *  测试：Windows 换行格式下，所有功能仍正常
    */
    @Test
    void shouldParseFrontMatterWithWindowsLineEndings() throws IOException {
        String markdown = """
            ---
            document_id: test-windows-line-endings
            knowledge_source: local-test
            ---
            # 测试文档

            这是正文。
            """.replace("\n", "\r\n");

        // 将字符串包装为内存资源
        Resource markdownResource = new ByteArrayResource(
                markdown.getBytes(StandardCharsets.UTF_8)
        ) {
            @Override
            public String getFilename() {
                return "windows-line-endings.md";
            }
        };

        // 把markdown解析器换成可控的 Mock。
        ResourcePatternResolver resourcePatternResolver =
                mock(ResourcePatternResolver.class);
        // 当加载器查询本地知识库路径时，不要访问真实目录，直接返回这个测试文档。
        when(resourcePatternResolver.getResources(
                "classpath*:rag/customer-service/local/**/*.md"
        )).thenReturn(new Resource[]{markdownResource});


        CustomerServiceDocumentLoader loader =
                new CustomerServiceDocumentLoader(
                        resourcePatternResolver
                );

        List<CustomerServiceSourceDocument> sourceDocuments = loader.loadMarkdowns();
        List<Document> documents = sourceDocuments.stream()
                .flatMap(source -> source.chunks().stream())
                .collect(Collectors.toList());

        assertFalse(documents.isEmpty());

        // 验证元数据是否正确解析
        boolean metadataParsed = documents.stream()
                .allMatch(document ->
                        "test-windows-line-endings".equals(
                                document.getMetadata().get("document_id")
                        )
                );

        // 验证source_id和document_id是否一致
        boolean sourceIdMatchesDocumentId = documents.stream()
                .allMatch(document ->
                        "test-windows-line-endings".equals(
                                document.getMetadata().get("source_id")
                        )
                );

        assertTrue(sourceIdMatchesDocumentId);
        assertTrue(metadataParsed);

        boolean frontMatterExcluded = documents.stream()
                .noneMatch(document ->
                        document.getText().contains("document_id:")
                );

        assertTrue(frontMatterExcluded);
    }

    @Test
    void shouldCalculateHashBeforeChunkingAndAttachItToChunks() {
        List<CustomerServiceSourceDocument> sourceDocuments = documentLoader.loadMarkdowns();

        assertFalse(sourceDocuments.isEmpty());
        assertTrue(sourceDocuments.stream().allMatch(source ->
                source.contentHash().length() == 64
                        && source.chunks().stream().allMatch(chunk ->
                        source.contentHash().equals(
                                chunk.getMetadata().get("content_hash")
                        ))
        ));
    }


}
