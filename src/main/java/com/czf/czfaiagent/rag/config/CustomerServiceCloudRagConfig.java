package com.czf.czfaiagent.rag.config;

import com.czf.czfaiagent.rag.properties.CustomerServiceCloudRagProperties;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
//不希望云知识库关闭时，Spring 仍然创建相关 Bean,所以使用 @ConditionalOnProperty 注解
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import com.alibaba.cloud.ai.dashscope.api.DashScopeApi;
import com.alibaba.cloud.ai.dashscope.rag.DashScopeDocumentRetriever;
import com.alibaba.cloud.ai.dashscope.rag.DashScopeDocumentRetrieverOptions;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.rag.advisor.RetrievalAugmentationAdvisor;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * 客户服务云 RAG 配置
 */
@Configuration
// 当 ai.rag.cloud.enabled 属性为 true 时，才创建这个配置类
@ConditionalOnProperty(
        prefix = "ai.rag.cloud",
        name = "enabled",
        havingValue = "true"
)
@EnableConfigurationProperties(
        CustomerServiceCloudRagProperties.class
)
public class CustomerServiceCloudRagConfig {

    // 注入配置类和apikey
    private final CustomerServiceCloudRagProperties properties;
    private final String dashScopeApiKey;

    public CustomerServiceCloudRagConfig(
            // 注入配置类
            CustomerServiceCloudRagProperties properties,
            // 从配置文件中读取 dashscope.api-key 属性
            @Value("${spring.ai.dashscope.api-key}")
            String dashScopeApiKey
    ) {
        this.properties = properties;
        this.dashScopeApiKey = dashScopeApiKey;
    }

    /**
     * 创建百炼云知识库检索器
     * 接收查询，然后从百炼云知识库返回相关 Document。
     * @return DashScopeDocumentRetriever
     */
    @Bean
    public DocumentRetriever customerServiceCloudDocumentRetriever() {
        // 创建 DashScope API 客户端
        DashScopeApi dashScopeApi = DashScopeApi.builder()
                .apiKey(dashScopeApiKey)
                .build();
        // 创建百炼云知识库检索器
        return new DashScopeDocumentRetriever(
                dashScopeApi,
                DashScopeDocumentRetrieverOptions.builder()
                        .withIndexName(
                                properties.getIndexName()
                        )
                        .withDenseSimilarityTopK(
                                properties.getDenseSimilarityTopK()
                        )
                        .withSparseSimilarityTopK(
                                properties.getSparseSimilarityTopK()
                        )
                        .withEnableRewrite(
                                properties.isEnableRewrite()
                        )
                        .withEnableReranking(
                                properties.isEnableReranking()
                        )
                        .withRerankTopN(
                                properties.getRerankTopN()
                        )
                        .build()
        );
    }



    /**
     * 创建百炼云知识库检索器
     * @return
     */
    @Bean
    public Advisor customerServiceCloudRagAdvisor(
            @Qualifier("customerServiceCloudDocumentRetriever")
            DocumentRetriever documentRetriever
    ) {
        return RetrievalAugmentationAdvisor.builder()
                .documentRetriever(documentRetriever)
                .build();
    }


}