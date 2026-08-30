package com.czf.czfaiagent.rag.config;

import com.czf.czfaiagent.rag.CustomerServiceDocumentLoader;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.ai.rag.retrieval.search.VectorStoreDocumentRetriever;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ai.document.Document;

import java.util.List;

// 表示这个类是 Spring 配置类。Spring 启动时会读取其中的 @Bean 方法。
@Configuration
public class CustomerServiceLocalRagConfig {
    // 表示向量库配置需要依赖文档加载器。
    private final CustomerServiceDocumentLoader documentLoader;

    // 构造器注入。
    public CustomerServiceLocalRagConfig(
            CustomerServiceDocumentLoader documentLoader
    ) {
        this.documentLoader = documentLoader;
    }

    /**
     本地文档向量库配置
     */
    @Bean
    public VectorStore customerServiceLocalVectorStore(
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

    /**
     * 本地文档检索器配置
     * 基于向量存储进行本地文档检索
     */
    @Bean
    public DocumentRetriever customerServiceLocalDocumentRetriever(
            @Qualifier("customerServiceLocalVectorStore")
            VectorStore vectorStore
    ) {
        return VectorStoreDocumentRetriever.builder()
                .vectorStore(vectorStore)
                .topK(4)
                .similarityThreshold(0.0)
                .build();
    }

    @Bean
    public Advisor customerServiceLocalRagAdvisor(
            @Qualifier("customerServiceLocalVectorStore")
            VectorStore vectorStore
    ) {
        return new QuestionAnswerAdvisor(vectorStore);
    }

}