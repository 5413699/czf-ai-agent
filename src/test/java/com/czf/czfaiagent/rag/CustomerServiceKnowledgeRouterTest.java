package com.czf.czfaiagent.rag;

import com.czf.czfaiagent.rag.properties.CustomerServiceKnowledgeSource;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CustomerServiceKnowledgeRouterTest {

    private final CustomerServiceKnowledgeRouter router =
            new CustomerServiceKnowledgeRouter();

    @Test
    void authorQuestionShouldUseCloudKnowledgeSource() {
        assertEquals(
                CustomerServiceKnowledgeSource.CLOUD_PUBLIC_AUTHOR_INFO,
                router.route("项目作者的微信公众号是什么？")
        );
    }

    @Test
    void websiteQuestionShouldUseLocalKnowledgeSource() {
        assertEquals(
                CustomerServiceKnowledgeSource.LOCAL,
                router.route("为什么时栈计时无法开始？")
        );
    }

    @Test
    void pomodoroQuestionShouldUseLocalKnowledgeSource() {
        assertEquals(
                CustomerServiceKnowledgeSource.LOCAL,
                router.route("番茄钟必须严格固定为 25 分钟吗？")
        );
    }

    @Test
    void blankQuestionShouldUseLocalKnowledgeSource() {
        assertEquals(
                CustomerServiceKnowledgeSource.LOCAL,
                router.route("  ")
        );
    }
}