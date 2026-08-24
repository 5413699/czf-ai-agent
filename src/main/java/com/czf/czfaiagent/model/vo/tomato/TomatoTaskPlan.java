package com.czf.czfaiagent.model.vo.tomato;

import java.util.List;

// 番茄任务计划（总）
public record TomatoTaskPlan(
        String goal,
        List<String> assumptions,
        List<TomatoTask> tasks,
        String completionSign,
        String firstAction
) {
}