package com.czf.czfaiagent.model.vo.tomato;

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