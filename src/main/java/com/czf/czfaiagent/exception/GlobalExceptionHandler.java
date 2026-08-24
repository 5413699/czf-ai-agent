package com.czf.czfaiagent.exception;

import com.czf.czfaiagent.common.ErrorCode;
import com.czf.czfaiagent.model.vo.common.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import java.util.UUID;

/**
 * 全局异常处理器。
 * @RestControllerAdvice监听 Controller 请求过程中抛出的异常：
 * 将 Controller 调用过程中抛出的异常，
 * 统一转换为 HTTP 状态码和 ErrorResponse。
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * 处理程序能够预期的业务异常。
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(
            BusinessException exception
    ) {
        String requestId = UUID.randomUUID().toString();
        ErrorCode errorCode = exception.getErrorCode();

        log.warn(
                "Business exception: requestId={}, code={}, message={}",
                requestId,
                errorCode.getCode(),
                exception.getMessage()
        );

        ErrorResponse response = new ErrorResponse(
                requestId,
                errorCode.getCode(),
                exception.getMessage()
        );

        // ResponseEntity能同时控制响应体和 HTTP 状态：
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }

    /**
     * 处理 @Valid 校验请求体失败的异常。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException exception
    ) {
        String requestId = UUID.randomUUID().toString();
        ErrorCode errorCode = ErrorCode.PARAMS_ERROR;

        FieldError fieldError = exception
                .getBindingResult()
                .getFieldError();

        String message = fieldError == null
                ? errorCode.getMessage()
                : fieldError.getDefaultMessage();

        log.warn(
                "Request validation failed: requestId={}, field={}, message={}",
                requestId,
                fieldError == null ? "unknown" : fieldError.getField(),
                message
        );

        ErrorResponse response = new ErrorResponse(
                requestId,
                errorCode.getCode(),
                message
        );

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }

    /**
     * 处理没有被业务异常覆盖的未知异常。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnknownException(
            Exception exception
    ) {
        String requestId = UUID.randomUUID().toString();
        ErrorCode errorCode = ErrorCode.SYSTEM_ERROR;

        log.error(
                "Unexpected exception: requestId={}",
                requestId,
                exception
        );

        ErrorResponse response = new ErrorResponse(
                requestId,
                errorCode.getCode(),
                errorCode.getMessage()
        );

        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(response);
    }
}