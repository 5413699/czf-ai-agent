package com.czf.czfaiagent.app;

import com.czf.czfaiagent.advisor.MyLoggerAdvisor;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.template.NoOpTemplateRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
@Slf4j
public class TomatoAssistantApp {

    private final ChatClient chatClient;

    public TomatoAssistantApp(
            // 构造器的参数，不要看成方法体
            ChatModel openAiChatModel,
            ResourceLoader resourceLoader,
            @Value("${ai.prompts.tomato-assistant.location}")
            String promptLocation
    ) {
        // 按名称从 classpath 加载提示词文件（类比 MyBatis 加载 mapper.xml）
        var promptResource = resourceLoader.getResource(promptLocation);

        // 初始化基于内存的对话记忆
        MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(20)
                .build();

        this.chatClient = ChatClient.builder(openAiChatModel)
                // 提示词包含 LaTeX 花括号，不进行模板变量解析，防止误解析
                .defaultTemplateRenderer(
                        new NoOpTemplateRenderer()
                )
                .defaultSystem(
                        promptResource,
                        StandardCharsets.UTF_8
                )
                .defaultAdvisors(
                        MessageChatMemoryAdvisor
                                .builder(chatMemory)
                                .build(),
                        new MyLoggerAdvisor()
                )
                .build();
    }


    public String doChat(String message, String chatId) {
        ChatResponse response = chatClient
                .prompt()// ① 创建一个 PromptSpec（提示词构建器）
                .user(message)// ② 设置用户消息
                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID , chatId))// ③ 给 Advisor 传参（这里是会话记忆的 chatId）
                .call()// ④ 真正发起一次同步（阻塞）调用，拿到响应对象
                .chatResponse();// ⑤ 从响应对象里取出 ChatResponse,其实这里可以直接.content()
        String content = response.getResult().getOutput().getText();
        //  log.info("content: {}", content);这里通过advior打印日志，不再重复进行
        return content;
    }

    // 番茄任务计划（总）
    public record TomatoTaskPlan(
            String goal,
            List<String> assumptions,
            List<TomatoTask> tasks,
            String completionSign,
            String firstAction
    ) {
    }
    // 单个番茄任务
    public record TomatoTask(
            String title,
            String action,
            String output,
            String completionCriteria,
            int estimatedMinutes,
            int pomodoroCount
    ) {
    }





}
