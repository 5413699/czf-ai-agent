package com.czf.czfaiagent.demo.invoke;

import jakarta.annotation.Resource;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Spring AI 框架调用 AI 大模型（阿里）
 */
// 取消注释后，项目启动时会执行
// 同时演示 阿里 dashscope + 自建 OpenAI 兼容 API）
@Component
public class SpringAiAiInvoke implements CommandLineRunner {

    @Resource(name = "dashscopeChatModel")
    private ChatModel dashscopeChatModel;
    @Resource(name = "openAiChatModel")
    private ChatModel openAiChatModel;

    /**
     * 调用模型
     */
    @Override
    public void run(String... args) {
        callModel("DashScope", dashscopeChatModel);
        callModel("自定义 API", openAiChatModel);
    }

    private void callModel(String modelName, ChatModel chatModel) {
        AssistantMessage message = chatModel
                .call(new Prompt("你好，请简单介绍一下自己"))
                .getResult()
                .getOutput();

        System.out.println(modelName + "：");
        System.out.println(message.getText());
    }

}
