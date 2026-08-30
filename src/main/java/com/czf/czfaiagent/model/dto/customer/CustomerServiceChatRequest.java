package com.czf.czfaiagent.model.dto.customer;

import jakarta.validation.constraints.NotBlank;

/**
 * 客服问答请求。
 *
 * @param message 用户问题
 * @param chatId  多轮会话标识
 */
public record CustomerServiceChatRequest(

        @NotBlank(message = "客服问题不能为空")
        String message,

        @NotBlank(message = "会话 ID 不能为空")
        String chatId
) {
}