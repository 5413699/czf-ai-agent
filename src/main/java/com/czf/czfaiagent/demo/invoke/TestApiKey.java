package com.czf.czfaiagent.demo.invoke;

/**
 * 仅用于测试获取 API Key
 */
public interface TestApiKey {

    // 从环境变量读取，避免将密钥提交到代码仓库
    String API_KEY = System.getenv("DASHSCOPE_API_KEY");
}
