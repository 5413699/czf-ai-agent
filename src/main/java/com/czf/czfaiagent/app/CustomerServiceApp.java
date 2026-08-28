package com.czf.czfaiagent.app;

import com.czf.czfaiagent.advisor.MyLoggerAdvisor;
import com.czf.czfaiagent.chatmemory.FileBasedChatMemory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ResourceLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 客户服务助手
 *
 */
public class CustomerServiceApp {


    // 调用模型
    private final ChatClient chatClient;
    private final String systemPrompt;

    public CustomerServiceApp (
            // 构造器的参数，不要看成方法体
            ChatModel openAiChatModel,
            ResourceLoader resourceLoader,
            @Value("${ai.prompts.customer-service.system-location}")
            String systemPromptLocation
    ) throws IOException {
        // 按名称从 classpath 加载提示词文件（类比 MyBatis 加载 mapper.xml）
        this.systemPrompt = resourceLoader
                .getResource(systemPromptLocation)
                .getContentAsString(StandardCharsets.UTF_8);

        // 初始化基于文件的对话记忆
        String fileDir = System.getProperty("user.dir") + "/tmp/chat-memory";
        ChatMemory chatMemory = new FileBasedChatMemory(fileDir);
        //        初始化基于内存的对话记忆
        //        MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder()
        //                .chatMemoryRepository(new InMemoryChatMemoryRepository())
        //                .maxMessages(20)
        //                .build();

        this.chatClient = ChatClient.builder(openAiChatModel)
                .defaultSystem(systemPrompt)
                .defaultAdvisors(
                        MessageChatMemoryAdvisor
                                .builder(chatMemory)
                                .build(),
                        new MyLoggerAdvisor()
                )
                .build();
    }




}
