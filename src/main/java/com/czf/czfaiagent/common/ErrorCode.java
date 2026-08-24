package com.czf.czfaiagent.common;


import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 项目统一错误码。
 *
 * A：用户输入或请求错误
 * B：项目内部系统错误
 * C：外部服务错误
 */

@Getter
public enum ErrorCode {

    PARAMS_ERROR(
            "A0001",
            "请求参数错误",
            HttpStatus.BAD_REQUEST
    ),

    SYSTEM_ERROR(
            "B0001",
            "系统内部异常",
            HttpStatus.INTERNAL_SERVER_ERROR
    ),

    AI_RESPONSE_ERROR(
            "C0001",
            "AI 服务响应异常",
            HttpStatus.BAD_GATEWAY
    );

    /**
     * 项目内部业务错误码。
     */
    private final String code;

    /**
     * 默认错误信息。
     */
    private final String message;

    /**
     * 对应的 HTTP 状态。
     */
    private final HttpStatus httpStatus;

    ErrorCode(
            String code,
            String message,
            HttpStatus httpStatus
    ) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

}