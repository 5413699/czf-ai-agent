package com.czf.czfaiagent.model.dto.tomato;
import com.czf.czfaiagent.common.PomodoroConstants;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * 前端请求生成番茄任务计划时给后端提交的数据。
 *
 * @param goal            用户希望完成的目标
 * @param context         当前进度、截止日期等背景与约束
 * @param pomodoroMinutes 单个番茄钟的分钟数
 * @param chatId          对话会话标识
 */
public record AiPlanRequest(

        @NotBlank(message = "任务目标不能为空")
        String goal,

        String context,

        @Min(
                value = PomodoroConstants.MIN_POMODORO_MINUTES,
                message = "番茄时长不能小于 5 分钟"
        )
        @Max(
                value = PomodoroConstants.MAX_POMODORO_MINUTES,
                message = "番茄时长不能大于 120 分钟"
        )
        Integer pomodoroMinutes,

        @NotBlank(message = "会话 ID 不能为空")
        String chatId
) {

    /**
     * 反序列化请求时，对可选字段设置默认值。
     */
    public AiPlanRequest {
        context = context == null ? "" : context;

        pomodoroMinutes = pomodoroMinutes == null
                ? PomodoroConstants.DEFAULT_POMODORO_MINUTES
                : pomodoroMinutes;
    }
}