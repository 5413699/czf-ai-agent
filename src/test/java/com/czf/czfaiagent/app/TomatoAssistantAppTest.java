package com.czf.czfaiagent.app;

import com.czf.czfaiagent.model.vo.tomato.TomatoTaskPlan;
import jakarta.annotation.Resource;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

@SpringBootTest
class TomatoAssistantAppTest {

    @Resource
    private TomatoAssistantApp tomatoAssistantApp;

    @Test
    void testChat() {
        String chatId = UUID.randomUUID().toString();
        // 第一轮
        String message = "你好，我是陈智飞，一句话自我介绍一下你自己";
        String answer = tomatoAssistantApp.doChat(message, chatId);
        Assertions.assertNotNull(answer);
        // 第二轮
        message = "学习leetcode题目：121. 买卖股票的最佳时机";
        answer = tomatoAssistantApp.doChat(message, chatId);
        Assertions.assertNotNull(answer);
        // 第三轮
        message = "你还记得我上个任务吗？";
        answer = tomatoAssistantApp.doChat(message, chatId);
        Assertions.assertNotNull(answer);
    }

    @Test
    void doChatWithReport() {
        String chatId = UUID.randomUUID().toString();
        // 第一轮
        String goal = "你好，我是陈智飞，我想学习java语言下贪心算法所可能涉及到语法";
        String context = "我已经完成了leetcode题目：121. 买卖股票的最佳时机";
        int pomodoroMinutes = 25;
        TomatoTaskPlan report = tomatoAssistantApp.doChatWithTaskPlan(goal,context,pomodoroMinutes,chatId);
        Assertions.assertNotNull(report);
    }


}
