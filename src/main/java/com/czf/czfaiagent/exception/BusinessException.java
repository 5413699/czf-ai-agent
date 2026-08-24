package com.czf.czfaiagent.exception;

import com.czf.czfaiagent.common.ErrorCode;
import lombok.Getter;

/**
 * 项目业务异常。
 *
 * 用于表示程序能够预期和识别的错误，
 * 例如参数错误、AI 返回结构异常等。
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    /**
     * 使用错误码中的默认错误信息。
     */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    /**
     * 使用本次业务场景的具体错误信息。
     */
    public BusinessException(
            ErrorCode errorCode,
            String message
    ) {
        super(message);
        this.errorCode = errorCode;
    }

    /**
     * 保留原始异常原因。
     */
    public BusinessException(
            ErrorCode errorCode,
            String message,
            Throwable cause
    ) {
        super(message, cause);
        this.errorCode = errorCode;
    }
}