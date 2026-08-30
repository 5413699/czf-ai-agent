package com.czf.czfaiagent.controller;

import com.czf.czfaiagent.app.CustomerServiceApp;
import com.czf.czfaiagent.model.dto.customer.CustomerServiceChatRequest;
import com.czf.czfaiagent.model.vo.customer.CustomerServiceChatResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 客服问答 HTTP 接口。
 */
@RestController
@RequestMapping("/customer-service")
public class CustomerServiceController {

    private final CustomerServiceApp customerServiceApp;

    public CustomerServiceController(
            CustomerServiceApp customerServiceApp
    ) {
        this.customerServiceApp = customerServiceApp;
    }

    /**
     * 使用本地 RAG 知识库回答客服问题。
     */
    @PostMapping("/chat")
    public CustomerServiceChatResponse chat(
            // 使用 @Valid 注解，进行CustomerServiceChatRequest参数校验。
            // @RequestBody把 HTTP 请求体里的 JSON 字符串，反序列化成后面对应的 Java 对象。
            @RequestBody @Valid
            CustomerServiceChatRequest request
    ) {
        String requestId =
                UUID.randomUUID().toString();

        // CustomerServiceChatRequest request是 record（Java 记录类），所以取值用访问器方法 request.message() / request.chatId()，而不是传统的 getMessage()
        String answer =
                customerServiceApp.doChatWithRag(
                        request.message(),
                        request.chatId()
                );

        return new CustomerServiceChatResponse(
                requestId,
                request.chatId(),
                answer
        );
    }
}