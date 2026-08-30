package com.czf.czfaiagent.model.vo.customer;

/**
 * 后端为前端生成的客服问答响应。
 *
 * @param requestId 本次请求的追踪标识
 * @param chatId    多轮会话标识
 * @param answer    客服生成的答案
 */
public record CustomerServiceChatResponse(
        String requestId,
        String chatId,
        String answer
) {
}