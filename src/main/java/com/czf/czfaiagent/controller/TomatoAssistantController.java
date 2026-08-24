package com.czf.czfaiagent.controller;

import com.czf.czfaiagent.app.TomatoAssistantApp;
import com.czf.czfaiagent.model.dto.tomato.AiPlanRequest;
import com.czf.czfaiagent.model.vo.tomato.AiPlanResponse;
import com.czf.czfaiagent.model.vo.tomato.TomatoTaskPlan;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 番茄助手 HTTP 接口。
 */
//接收 HTTP 请求、返回数据（通常是 JSON）给前端的类。
@RestController
@RequestMapping("/tomato-assistant")
public class TomatoAssistantController {

    private final TomatoAssistantApp tomatoAssistantApp;

    public TomatoAssistantController(
            TomatoAssistantApp tomatoAssistantApp
    ) {
        this.tomatoAssistantApp = tomatoAssistantApp;
    }

    /**
     * 根据用户目标生成结构化番茄任务计划。
     */
    @PostMapping("/plans")
    public AiPlanResponse createPlan(
            @Valid @RequestBody AiPlanRequest request
    ) {
        String requestId = UUID.randomUUID().toString();

        TomatoTaskPlan plan =
                tomatoAssistantApp.doChatWithTaskPlan(
                        request.goal(),
                        request.context(),
                        request.pomodoroMinutes(),
                        request.chatId()
                );

        return new AiPlanResponse(
                requestId,
                request.chatId(),
                request.pomodoroMinutes(),
                plan
        );
    }
}