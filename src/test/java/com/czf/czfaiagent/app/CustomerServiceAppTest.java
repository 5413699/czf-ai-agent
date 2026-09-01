package com.czf.czfaiagent.app;

import com.czf.czfaiagent.model.vo.tomato.TomatoTaskPlan;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

@SpringBootTest
public class CustomerServiceAppTest {

    @Resource
    private CustomerServiceApp customerServiceApp;

    @Test
    void doChatWithRag() {
        String chatId = "rag-rewrite-001";

        customerServiceApp.doChatWithRag(
                "我在专注页面看到很多方案，我可以自己设置方案吗",
                chatId
        );

        String answer = customerServiceApp.doChatWithRag(
                "页面元素太多了，有没有办法能够屏蔽掉页面元素，让我专注番茄钟计时？",
                chatId
        );

        Assertions.assertNotNull(answer);
    }

}
