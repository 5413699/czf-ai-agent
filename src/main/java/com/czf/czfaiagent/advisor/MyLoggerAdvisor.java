package com.czf.czfaiagent.advisor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClientMessageAggregator;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import reactor.core.publisher.Flux;

import java.util.List;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 自定义日志 Advisor
 * 打印 info 级别日志、只输出单次用户提示词和 AI 回复的文本
 */
@Slf4j
public class MyLoggerAdvisor implements CallAdvisor, StreamAdvisor {

    // 标记 system 是否已经打印过（每个app角色只打一次）
    private final AtomicBoolean SYSTEM_LOGGED = new AtomicBoolean(false);


	@Override
	public String getName() {
		return this.getClass().getSimpleName();
	}

    // 指定优先级
	@Override
	public int getOrder() {
		return 0;
	}

    private ChatClientRequest before(ChatClientRequest request) {
        List<Message> instructions = request.prompt().getInstructions();

        // 系统提示词：仅首次打印一次
        instructions.stream()
                .filter(m -> m.getMessageType() == MessageType.SYSTEM)
                .findFirst()
                .ifPresent(system -> {
                    if (SYSTEM_LOGGED.compareAndSet(false, true)) {
                        log.info("System Prompt: {}", system.getText());
                    }
                });

        // 只打印本轮用户输入（最后一条 USER 消息）
        instructions.stream()
                .filter(m -> m.getMessageType() == MessageType.USER)
                // 归约”操作，把流里的元素两两合并，最终得到一个值。不断用后一条覆盖前一条，最后剩下的就是最后一条” 的经典 trick
                // 返回的是 Optional<Message>（因为流可能为空，比如没有任何 USER 消息时）。
                 .reduce((first, second) -> second)   // 取最后一条
                // 如果有值（即确实有 USER 消息），才执行里面的打印逻辑；
                .ifPresent(user -> log.info("User: {}", user.getText()));

        return request;
    }

	private void observeAfter(ChatClientResponse chatClientResponse) {
		log.info("AI Response: {}", chatClientResponse.chatResponse().getResult().getOutput().getText());
	}

	@Override
	public ChatClientResponse adviseCall(ChatClientRequest chatClientRequest, CallAdvisorChain chain) {
		chatClientRequest = before(chatClientRequest);
		ChatClientResponse chatClientResponse = chain.nextCall(chatClientRequest);
		observeAfter(chatClientResponse);
		return chatClientResponse;
	}

	@Override
	public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest, StreamAdvisorChain chain) {
		chatClientRequest = before(chatClientRequest);
		Flux<ChatClientResponse> chatClientResponseFlux = chain.nextStream(chatClientRequest);
		return (new ChatClientMessageAggregator()).aggregateChatClientResponse(chatClientResponseFlux, this::observeAfter);
	}
}
