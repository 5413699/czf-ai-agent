package com.czf.czfaiagent.controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


/**
 * 健康检查接口
 */

//声明"这是一个处理网络请求的类"
@RestController
//声明"这个类处理的请求路径是/health"
@RequestMapping("/health")
public class HealthController {
    // 声明这个方法处理对 /health 的 GET 请求
    @GetMapping
    public String healthCheck() {
        return "ok";
    }
}
