package com.czf.czfaiagent.app;

import jakarta.annotation.Resource;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

@SpringBootTest
class SfcProfessorAppTest {

    @Resource
    private SfcProfessorApp sfcProfessorApp;

    @Test
    void testChat() {
        String chatId = UUID.randomUUID().toString();
        // 第一轮
        String message = "你好，我是陈智飞，一句话自我介绍一下你自己";
        String answer = sfcProfessorApp.doChat(message, chatId);
        Assertions.assertNotNull(answer);
        // 第二轮
        message = "一句话讲解为什么多播sfc部署需要启发式算法";
        answer = sfcProfessorApp.doChat(message, chatId);
        Assertions.assertNotNull(answer);
        // 第三轮
        message = "你还记得我是谁吗？";
        answer = sfcProfessorApp.doChat(message, chatId);
        Assertions.assertNotNull(answer);
    }



}
