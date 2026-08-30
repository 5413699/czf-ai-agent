package com.czf.czfaiagent.rag.properties;
import lombok.Getter;
import lombok.Setter;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 客户服务云 RAG 配置
 */
@Setter
@Getter

// 这里采用@ConfigurationProperties将配置文件中的属性映射到这个类中，后续需在配置类显式启用配置属性类
// 这里不使用@bean，是为了避免bean的重复注册，导致NoUniqueBeanDefinitionException
@ConfigurationProperties(prefix = "ai.rag.cloud")
public class CustomerServiceCloudRagProperties {

    private boolean enabled;
    private String indexName;
    // 相似度计算参数
    private int denseSimilarityTopK;
    // 稀疏相似度
    private int sparseSimilarityTopK;
    // 重写和重排序
    private boolean enableRewrite;
    private boolean enableReranking;

    private int rerankTopN;


}