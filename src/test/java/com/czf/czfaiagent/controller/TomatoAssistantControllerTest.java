package com.czf.czfaiagent.controller;

import com.czf.czfaiagent.app.TomatoAssistantApp;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.czf.czfaiagent.model.vo.tomato.TomatoTask;
import com.czf.czfaiagent.model.vo.tomato.TomatoTaskPlan;

import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;




@WebMvcTest(TomatoAssistantController.class)
class TomatoAssistantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    /**
     * 使用模拟对象替代真实 TomatoAssistantApp，
     * 防止测试时调用真正的 AI 接口。
     */
    @MockitoBean
    private TomatoAssistantApp tomatoAssistantApp;

    @Test
    void shouldReturnBadRequestWhenPomodoroMinutesTooSmall()
            throws Exception {

        String requestBody = """
                {
                  "goal": "完成 Spring AI 接口",
                  "context": "已经完成模型接入",
                  "pomodoroMinutes": 3,
                  "chatId": "chat-001"
                }
                """;

        mockMvc.perform(
                        post("/tomato-assistant/plans")
                                .contentType("application/json")
                                .content(requestBody)
                )
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.code").value("A0001"))
                .andExpect(
                        jsonPath("$.message")
                                .value("番茄时长不能小于 5 分钟")
                );
    }

    @Test
    void shouldUseDefaultPomodoroMinutesWhenNotProvided()
            throws Exception {

        TomatoTaskPlan plan = new TomatoTaskPlan(
                "完成 Spring AI 接口",
                List.of(),
                List.of(
                        new TomatoTask(
                                "验证接口",
                                "调用任务拆解接口",
                                "获得结构化任务计划",
                                "接口返回 HTTP 200",
                                25,
                                1
                        )
                ),
                "接口能够正常返回结构化任务计划",
                "启动后端并发送请求"
        );

        when(
                tomatoAssistantApp.doChatWithTaskPlan(
                        eq("完成 Spring AI 接口"),
                        eq("已经完成模型接入"),
                        eq(25),
                        eq("chat-001")
                )
        ).thenReturn(plan);

        //  构造请求体（故意不含 pomodoroMinutes）
        String requestBody = """
            {
              "goal": "完成 Spring AI 接口",
              "context": "已经完成模型接入",
              "chatId": "chat-001"
            }
            """;

        // 模拟发 HTTP 请求给 Controller。
        mockMvc.perform(
                        post("/tomato-assistant/plans")
                                .contentType("application/json")
                                .content(requestBody)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.chatId").value("chat-001"))
                .andExpect(jsonPath("$.pomodoroMinutes").value(25))
                .andExpect(
                        jsonPath("$.plan.goal")
                                .value("完成 Spring AI 接口")
                )
                .andExpect(jsonPath("$.plan.tasks.length()").value(1))
                .andExpect(
                        jsonPath("$.plan.tasks[0].estimatedMinutes")
                                .value(25)
                )
                .andExpect(
                        jsonPath("$.plan.tasks[0].pomodoroCount")
                                .value(1)
                );

        verify(tomatoAssistantApp)
                .doChatWithTaskPlan(
                        "完成 Spring AI 接口",
                        "已经完成模型接入",
                        25,
                        "chat-001"
                );
    }




}