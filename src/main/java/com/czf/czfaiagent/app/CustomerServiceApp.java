package com.czf.czfaiagent.app;

import com.czf.czfaiagent.advisor.MyLoggerAdvisor;
import com.czf.czfaiagent.chatmemory.FileBasedChatMemory;
import com.czf.czfaiagent.rag.CustomerServiceKnowledgeRouter;
import com.czf.czfaiagent.rag.properties.CustomerServiceKnowledgeSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.api.Advisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.ai.chat.model.ChatResponse;

/**
 * 客户服务助手
 *
 */
@Slf4j
@Component
public class CustomerServiceApp {


    // 调用模型
    private final ChatClient chatClient;
    private final String systemPrompt;

    // 已经组装好的RAG拦截器。
    private final Advisor customerServiceLocalRagAdvisor;
    private final Optional<Advisor> customerServiceCloudRagAdvisor;
    // 知识库路由器
    private final CustomerServiceKnowledgeRouter knowledgeRouter;



    /**
     * 构造器注入
     * @param openAiChatModel
     * @param resourceLoader
     * @param systemPromptLocation
     * @param customerServiceLocalRagAdvisor
     * @param customerServiceCloudRagAdvisor
     * @throws IOException
     */
    public CustomerServiceApp (
            // 使用自定义 OpenAI 兼容 ChatModel 生成客服回答
            @Qualifier("openAiChatModel")
            ChatModel openAiChatModel,
            // 加载系统提示词文件
            ResourceLoader resourceLoader,
            @Value("${ai.prompts.customer-service.system-location}")
            String systemPromptLocation,
            // RAG知识库路由器
            CustomerServiceKnowledgeRouter knowledgeRouter,
            // 本地与阿里云RAG拦截器
            @Qualifier("customerServiceLocalRagAdvisor")
            Advisor customerServiceLocalRagAdvisor,
            @Qualifier("customerServiceCloudRagAdvisor")
            Optional<Advisor> customerServiceCloudRagAdvisor


    ) throws IOException {
        // 按名称从 classpath 加载提示词文件（类比 MyBatis 加载 mapper.xml）
        this.systemPrompt = resourceLoader
                .getResource(systemPromptLocation)
                .getContentAsString(StandardCharsets.UTF_8);

        // 初始化基于文件的对话记忆
        String fileDir = System.getProperty("user.dir") + "/tmp/chat-memory";
        ChatMemory chatMemory = new FileBasedChatMemory(fileDir);
        //        初始化基于内存的对话记忆
        //        MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder()
        //                .chatMemoryRepository(new InMemoryChatMemoryRepository())
        //                .maxMessages(20)
        //                .build();

        this.chatClient = ChatClient.builder(openAiChatModel)
                .defaultSystem(systemPrompt)
                .defaultAdvisors(
                        MessageChatMemoryAdvisor
                                .builder(chatMemory)
                                .build(),
                        new MyLoggerAdvisor()
                )
                .build();

        this.knowledgeRouter = knowledgeRouter;
        this.customerServiceLocalRagAdvisor = customerServiceLocalRagAdvisor;
        this.customerServiceCloudRagAdvisor = customerServiceCloudRagAdvisor;
    }

    /**
     * 使用本地向量知识库回答客服问题。
     *
     * @param message 用户问题
     * @param chatId  会话标识
     * @return 模型根据检索资料生成的答案
     */
    public String doChatWithRag(
            String message,
            String chatId
    ) {
        CustomerServiceKnowledgeSource source =
                knowledgeRouter.route(message);
        log.info(
                "customer service knowledge source: {}",
                source
        );



        // 根据知识源选择对应的RAG拦截器
        Advisor selectedAdvisor;
        if (source == CustomerServiceKnowledgeSource.CLOUD_PUBLIC_AUTHOR_INFO) {
            if (customerServiceCloudRagAdvisor.isEmpty()) {
                return "当前暂时无法查询作者公开信息，请稍后重试。";
            }
            selectedAdvisor = customerServiceCloudRagAdvisor.get();
        } else {
            selectedAdvisor =
                    customerServiceLocalRagAdvisor;
        }

        // 调用模型
        ChatResponse chatResponse = chatClient
                .prompt()
                .user(message)
                // 将本轮请求归入指定会话
                .advisors(spec ->
                        spec.param(
                                ChatMemory.CONVERSATION_ID,
                                chatId
                        )
                )
                // 检索被路由的向量库，并把相关文档片段加入模型上下文
                .advisors(
                        selectedAdvisor
                )
                .call()
                .chatResponse();

        return chatResponse
                .getResult()
                .getOutput()
                .getText();
    }


}
