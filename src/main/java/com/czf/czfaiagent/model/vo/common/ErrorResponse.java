package com.czf.czfaiagent.model.vo.common;

/**
 * HTTP 请求失败时返回给前端的统一结构。
 *
 * @param requestId 本次请求的追踪标识
 * @param code      项目业务错误码
 * @param message   可向用户展示的错误信息
 */
public record ErrorResponse(
        String requestId,
        String code,
        String message
) {
}