package com.czf.czfaiagent.rag.config;

import com.czf.czfaiagent.rag.LoggingQueryTransformer;
import org.springframework.ai.chat.client.advisor.api.Advisor;

import org.springframework.ai.rag.advisor.RetrievalAugmentationAdvisor;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.ai.rag.retrieval.search.VectorStoreDocumentRetriever;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.rag.preretrieval.query.transformation.QueryTransformer;
import org.springframework.ai.rag.preretrieval.query.transformation.RewriteQueryTransformer;

// 表示这个类是 Spring 配置类。Spring 启动时会读取其中的 @Bean 方法。
@Configuration
public class CustomerServiceLocalRagConfig {
    /**
     本地文档向量库配置
     */
    @Bean
    public VectorStore customerServiceLocalVectorStore(
            JdbcTemplate jdbcTemplate,
            EmbeddingModel dashscopeEmbeddingModel
    ) {

        // 基于PostgreSQL向量库进行向量存储
        PgVectorStore vectorStore =
                PgVectorStore.builder(
                                // 向量库的数据库连接信息
                                jdbcTemplate,
                                // 向量库的嵌入模型
                                dashscopeEmbeddingModel
                        )
                        .dimensions(1536)
                        // 客服问答通常比较关注语义方向，使用余弦距离计算向量相似度。
                        .distanceType(
                                PgVectorStore.PgDistanceType.COSINE_DISTANCE
                        )
                        // 使用文本类型ID，文本类型ID是文档的唯一标识符，用于在向量库中查找文档。
                        .idType(PgVectorStore.PgIdType.TEXT)
                        //
                        .indexType(
                                PgVectorStore.PgIndexType.HNSW
                        )
                        .initializeSchema(true)
                        .build();

        // 进行向量存储时，将向量化的文档存储在jvm内存
        //        SimpleVectorStore vectorStore =
        //                SimpleVectorStore.builder(
        //                        dashscopeEmbeddingModel
        //                ).build();
        //        // 加载文档
        //        // 向量存储中添加文档
        //        vectorStore.add(documents);


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

    /**
     * 创建一个带日志能力的查询转换器
     * 先用大模型改写用户提问，再把改写前后的内容打印到日志里，最后把这个组合体注册成 Spring bean。
     */
    @Bean
    public QueryTransformer customerServiceLocalQueryTransformer(
            @Qualifier("dashscopeChatModel")
            ChatModel dashscopeChatModel
    ) {
        // 使用dashscopeChatModel进行查询转换
        QueryTransformer delegate =
                // Spring AI 内置的查询改写器，它会调大模型把用户的原始提问改写得更适合检索。
                RewriteQueryTransformer.builder()
                        .chatClientBuilder(
                                ChatClient.builder(dashscopeChatModel)
                        )
                        .build();

        // 委托对象是装饰器模式的标准命名，暗示"真正干活的是它"。
        return new LoggingQueryTransformer(delegate);
    }


    /**
     * 本地知识库的 RAG 检索增强顾问。
     * 这是本地 RAG 流程的"总装"环节：把查询转换器和文档检索器组装成一个 Advisor，
     * 挂到 ChatClient 上之后，大模型在回答前就会自动检索本地知识库。
     * 一次问答的执行链路：
     *     <li>查询转换（queryTransformer）：先由大模型把用户的原始提问改写成
     *         更适合检索的表述，例如补全上下文、消除指代词歧义；</li>
     *     <li>文档检索（documentRetriever）：用改写后的查询到本地向量库中做
     *         相似度检索，取回最相关的若干文档片段；</li>
     *     <li>知识增强：把检索到的文档片段拼接到提示词中，
     *         再交给大模型生成最终答案。</li>
     * </ol>
     *
     * @param queryTransformer  查询转换器，在检索前改写用户提问以提高召回准确率
     * @param documentRetriever 文档检索器，基于本地向量库做相似度检索
     * @return 装配好的检索增强顾问，可供 ChatClient 通过 advisors 使用
     */
    @Bean
    public Advisor customerServiceLocalRagAdvisor(
            @Qualifier("customerServiceLocalQueryTransformer")
            QueryTransformer queryTransformer,

            @Qualifier("customerServiceLocalDocumentRetriever")
            DocumentRetriever documentRetriever
    ) {
        return RetrievalAugmentationAdvisor.builder()
                .queryTransformers(queryTransformer)
                .documentRetriever(documentRetriever)
                .build();
    }

}
