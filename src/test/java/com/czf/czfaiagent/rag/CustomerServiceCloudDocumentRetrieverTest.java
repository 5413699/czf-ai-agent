package com.czf.czfaiagent.rag;

import com.czf.czfaiagent.rag.config.CustomerServiceCloudRagConfig;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.ai.rag.Query;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.List;
import org.springframework.test.context.ActiveProfiles;
/**
 * 客户服务云 RAG 配置测试
 */

//测试的目标是：验证百炼云知识库检索器,只加载云 RAG 需要的两个类：避免测试边界过宽。
@SpringBootTest(classes = {
        CustomerServiceCloudRagConfig.class,
})
// 使用 local 配置文件
@ActiveProfiles("local")
public class CustomerServiceCloudDocumentRetrieverTest {

    @Resource(name = "customerServiceCloudDocumentRetriever")
    private DocumentRetriever documentRetriever;

    /**
     * 测试：
     * 1. 云知识库应该召回至少一个文档片段。
     * 2. 召回结果应该包含已确认的微信公众号名称。
     */
    @Test
    public void shouldRetrievePublicAuthorContact() {
        List<Document> documents = documentRetriever.retrieve(
                new Query("项目作者的微信公众号是什么？")
        );

        assertFalse(
                documents.isEmpty(),
                "云知识库应该召回至少一个文档片段"
        );

        assertTrue(
                documents.stream()
                        .anyMatch(document ->
                                document.getText().contains("垫材")
                        ),
                "召回结果应该包含已确认的微信公众号名称"
        );


    }

}
