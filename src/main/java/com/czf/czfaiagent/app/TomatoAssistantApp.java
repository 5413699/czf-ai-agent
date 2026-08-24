package com.czf.czfaiagent.app;

import com.czf.czfaiagent.advisor.MyLoggerAdvisor;
import com.czf.czfaiagent.common.ErrorCode;
import com.czf.czfaiagent.exception.BusinessException;
import com.czf.czfaiagent.model.vo.tomato.TomatoTask;
import com.czf.czfaiagent.model.vo.tomato.TomatoTaskPlan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import com.czf.czfaiagent.common.PomodoroConstants;
@Component
@Slf4j
public class TomatoAssistantApp {

    // 调用模型
    private final ChatClient chatClient;
    // 番茄助手角色与拆解规则
    private final String systemPrompt;
    // 结构化输出字段要求
    private final String taskPlanFormatPrompt;




    public TomatoAssistantApp (
            // 构造器的参数，不要看成方法体
            ChatModel openAiChatModel,
            ResourceLoader resourceLoader,
            @Value("${ai.prompts.tomato-assistant.system-location}")
            String systemPromptLocation,
            @Value("${ai.prompts.tomato-assistant.task-plan-format-location}")
            String taskPlanFormatLocation
    ) throws IOException {
        // 按名称从 classpath 加载提示词文件（类比 MyBatis 加载 mapper.xml）
        this.systemPrompt = resourceLoader
                .getResource(systemPromptLocation)
                .getContentAsString(StandardCharsets.UTF_8);

        this.taskPlanFormatPrompt = resourceLoader
                .getResource(taskPlanFormatLocation)
                .getContentAsString(StandardCharsets.UTF_8);

        // 初始化基于内存的对话记忆
        MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(20)
                .build();

        this.chatClient = ChatClient.builder(openAiChatModel)
                .defaultAdvisors(
                        MessageChatMemoryAdvisor
                                .builder(chatMemory)
                                .build(),
                        new MyLoggerAdvisor()
                )
                .build();
    }

    // 重载方法。用户未指定番茄时间时，使用默认时间
    public String doChat(String message, String chatId) {
        return doChat(message, chatId, PomodoroConstants.DEFAULT_POMODORO_MINUTES);
    }

    // 用户指定番茄时间时，先用validatePomodoroMinutes校验番茄时间是否在5-120分钟之间
    public String doChat(
            String message,
            String chatId,
            int pomodoroMinutes
    ) {

        validatePomodoroMinutes(pomodoroMinutes);

        ChatResponse response = chatClient
                .prompt()// 开启一个提示词构建器
                .system(spec -> spec
                        .text(systemPrompt)//模板字符串
                        .param("pomodoroMinutes", pomodoroMinutes)// 把变量 pomodoroMinutes 的值填入模板的 {pomodoroMinutes} 占位符。
                )
                .user(message)
                .advisors(spec ->
                        spec.param(ChatMemory.CONVERSATION_ID, chatId)
                )
                .call()
                .chatResponse();

        return response.getResult()
                .getOutput()
                .getText();
    }

    // 校验番茄时间是否在5-120分钟之间
    private void validatePomodoroMinutes(int pomodoroMinutes) {
        if (pomodoroMinutes < PomodoroConstants.MIN_POMODORO_MINUTES
                || pomodoroMinutes > PomodoroConstants.MAX_POMODORO_MINUTES) {
            throw new BusinessException(
                    ErrorCode.PARAMS_ERROR,
                    "番茄时长必须在 %d 到 %d 分钟之间"
                            .formatted(
                                    PomodoroConstants.MIN_POMODORO_MINUTES,
                                    PomodoroConstants.MAX_POMODORO_MINUTES
                            )
            );
        }
    }

    public TomatoTaskPlan doChatWithTaskPlan(
            String goal,
            String context,
            int pomodoroMinutes,
            String chatId
    ) {
        validatePomodoroMinutes(pomodoroMinutes);

        if (goal == null || goal.isBlank()) {
            throw new BusinessException(
                    ErrorCode.PARAMS_ERROR,
                    "任务目标不能为空"
            );
        }

        String userMessage = """
            本次目标：
            %s

            背景与约束：
            %s
            """.formatted(
                goal,
                context == null || context.isBlank()
                        ? "无"
                        : context
        );


        TomatoTaskPlan taskPlan;
        try {
            taskPlan = chatClient
                    .prompt()
                    .system(spec -> spec
                            .text(
                                    systemPrompt
                                            + "\n\n"
                                            + taskPlanFormatPrompt
                            )
                            .param(
                                    "pomodoroMinutes",
                                    pomodoroMinutes
                            )
                    )
                    .user(userMessage)
                    .advisors(spec ->
                            spec.param(
                                    ChatMemory.CONVERSATION_ID,
                                    chatId
                            )
                    )
                    .call()
                    .entity(TomatoTaskPlan.class);
        } catch (Exception exception) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "生成番茄任务清单失败",
                    exception
            );
        }
        validateTaskPlan(taskPlan, pomodoroMinutes);
        return taskPlan;

    }

    // 校验番茄任务清单
    private void validateTaskPlan(
            TomatoTaskPlan taskPlan,
            int pomodoroMinutes
    ) {
        if (taskPlan == null) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "AI 返回的任务计划为空"
            );
        }

        if (taskPlan.assumptions() == null) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "AI 返回的假设列表为空"
            );
        }

        if (taskPlan.tasks() == null || taskPlan.tasks().isEmpty()) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "AI 未生成任何微任务"
            );
        }

        for (TomatoTask task : taskPlan.tasks()) {
            validateTomatoTask(task, pomodoroMinutes);
        }
    }

    // 校验番茄任务
    private void validateTomatoTask(
            TomatoTask task,
            int pomodoroMinutes
    ) {
        if (task == null) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "AI 返回了空的微任务"
            );
        }

        int estimatedMinutes = task.estimatedMinutes();
        int pomodoroCount = task.pomodoroCount();

        if (estimatedMinutes <= 0
                || estimatedMinutes > pomodoroMinutes * 2) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "微任务预计时间必须大于 0，且不能超过两个番茄钟"
            );
        }

        if (pomodoroCount < 1 || pomodoroCount > 2) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "微任务的番茄钟数量只能是 1 或 2"
            );
        }

        int expectedPomodoroCount =
                estimatedMinutes <= pomodoroMinutes ? 1 : 2;

        if (pomodoroCount != expectedPomodoroCount) {
            throw new BusinessException(
                    ErrorCode.AI_RESPONSE_ERROR,
                    "微任务预计时间与番茄钟数量不一致"
            );
        }
    }








}
