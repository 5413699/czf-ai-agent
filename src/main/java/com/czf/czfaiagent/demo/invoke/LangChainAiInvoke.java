package com.czf.czfaiagent.demo.invoke;

import dev.langchain4j.community.model.dashscope.QwenChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;

public class LangChainAiInvoke {

    public static void main(String[] args) {
//        ChatLanguageModel qwenChatModel = QwenChatModel.builder()
//                .apiKey(TestApiKey.API_KEY)
//                .modelName("qwen-max")
//                .build();
//        String answer = qwenChatModel.chat("我是程序员鱼皮，这是编程导航 codefather.cn 的 AI 超级智能体原创项目");

        // 配置自定义模型
        ChatLanguageModel openAiChatModel = OpenAiChatModel.builder()
                .baseUrl("https://nowcoding.ai/v1")
                .apiKey(TestApiKey.OPENAI_API_KEY)
                .modelName("gpt-5.6-terra")
                .temperature(0.7)
                .build();
        String answer2 = openAiChatModel.chat("我是陈智飞，一句话介绍一下你自己");

        System.out.println(answer2);
    }
}
