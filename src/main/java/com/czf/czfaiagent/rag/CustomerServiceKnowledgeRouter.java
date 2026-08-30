package com.czf.czfaiagent.rag;

import com.czf.czfaiagent.rag.properties.CustomerServiceKnowledgeSource;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Component
public class CustomerServiceKnowledgeRouter {

    private static final Set<String> AUTHOR_INFO_KEYWORDS = Set.of(
            "作者",
            "公众号",
            "小红书",
            "邮箱",
            "联系方式",
            "github",
            "仓库",
            "源码"
    );

    /**
     * 路由知识源
     * @param message 用户输入的消息
     * @return 知识源
     */
    public CustomerServiceKnowledgeSource route(String message) {
        // 如果消息为空，则默认使用本地知识源
        if (message == null || message.isBlank()) {
            return CustomerServiceKnowledgeSource.LOCAL;
        }

        // 将消息转换为小写，以便进行关键词匹配
        String normalizedMessage =
                message.toLowerCase(Locale.ROOT);


        boolean isAuthorInfoQuestion =
                AUTHOR_INFO_KEYWORDS.stream()
                        .anyMatch(normalizedMessage::contains);

        // 如果消息中包含作者信息关键词，则使用云知识源
        if (isAuthorInfoQuestion) {
            return CustomerServiceKnowledgeSource
                    .CLOUD_PUBLIC_AUTHOR_INFO;
        }

        // 默认使用本地知识源
        return CustomerServiceKnowledgeSource.LOCAL;
    }
}