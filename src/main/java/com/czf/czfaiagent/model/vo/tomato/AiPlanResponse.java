package com.czf.czfaiagent.model.vo.tomato;

/**
 * 后端生成番茄任务计划成功时返回给前端的数据。
 *
 * @param requestId       本次请求的追踪标识
 * @param chatId          对话会话标识
 * @param pomodoroMinutes 本次采用的单个番茄钟时长
 * @param plan            AI 生成的结构化任务计划
 */
public record AiPlanResponse(
        String requestId,
        String chatId,
        int pomodoroMinutes,
        TomatoTaskPlan plan
) {
}