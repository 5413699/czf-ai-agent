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

        String message = "番茄钟必须严格固定为 25 分钟吗";
        String chatId = "rag-learning-002";
        String answer = customerServiceApp.doChatWithRag(message,chatId);
        Assertions.assertNotNull(answer);

    }


}
