package com.czf.czfaiagent.rag;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ai.document.Document;

import java.util.List;

// 表示这个类是 Spring 配置类。Spring 启动时会读取其中的 @Bean 方法。
@Configuration
public class CustomerServiceVectorStoreConfig {
    // 表示向量库配置需要依赖文档加载器。
    private final CustomerServiceDocumentLoader documentLoader;

    // 构造器注入。
    public CustomerServiceVectorStoreConfig(
            CustomerServiceDocumentLoader documentLoader
    ) {
        this.documentLoader = documentLoader;
    }

    // 向量库配置
    @Bean
    public VectorStore customerServiceVectorStore(
            EmbeddingModel dashscopeEmbeddingModel
    ) {
        // 进行向量存储时，使用dashscopeEmbeddingModel进行embedding
        SimpleVectorStore vectorStore =
                SimpleVectorStore.builder(
                        dashscopeEmbeddingModel
                ).build();

        // 加载文档
        List<Document> documents = documentLoader.loadMarkdowns();
        // 向量存储中添加文档
        vectorStore.add(documents);


        return vectorStore;
    }
}