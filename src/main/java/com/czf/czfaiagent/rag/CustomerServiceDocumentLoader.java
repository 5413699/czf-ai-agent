package com.czf.czfaiagent.rag;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.markdown.MarkdownDocumentReader;
import org.springframework.ai.reader.markdown.config.MarkdownDocumentReaderConfig;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;
import java.util.LinkedHashMap;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;


/**
 * 客服应用文档加载器
 *      ├── 找到文件
 *      ├── 解析 Front Matter
 *      ├── 调用 MarkdownDocumentReader
 *      └── 给切片补充 metadata
 */

//把这个类注册成 Spring 管理的 bean，这样别的类（如配置类、Service）可以直接 @Autowired 注入它，
@Component
//自动生成一个日志对象 log
@Slf4j
public class CustomerServiceDocumentLoader {
    // Spring 提供的资源解析器，能按通配符从 classpath、文件系统、URL 等位置加载资源（Resource）。
    // 因为类上有 @Component，Spring 启动时会自动找到一个 ResourcePatternResolver 类型的 bean（Spring 默认就提供了）注入进来，不需要手动 new。
    // 这里用的是构造器注入
    private final ResourcePatternResolver resourcePatternResolver;
    // Front Matter 分隔符
    private static final String FRONT_MATTER_DELIMITER = "---";

    public CustomerServiceDocumentLoader(ResourcePatternResolver resourcePatternResolver) {
        this.resourcePatternResolver = resourcePatternResolver;
    }

    /**
     * Front Matter 解析结果。
     *
     * @param metadata YAML 元数据
     * @param body      去除 Front Matter 后的 Markdown 正文
     */
    private record ParsedMarkdown(
            Map<String, Object> metadata,
            String body
    ) {
    }

    /**
     * 解析 Markdown 顶部的 YAML Front Matter。
     *
     * @param rawText 完整的 Markdown 文件内容
     * @return 解析得到的元数据和 Markdown 正文
     */
    private ParsedMarkdown parseFrontMatter(String rawText) {

        // 将换行符，统一为 \n，得到normalizedText
        String normalizedText = rawText
                .replace("\r\n", "\n")
                .replace('\r', '\n');

        // 如果 normalizedText 不以独立的 --- 行开头，就认为它没有 Front Matter，元数据返回空 Map，正文原样返回。
        if (!normalizedText.startsWith(FRONT_MATTER_DELIMITER + "\n")) {
            return new ParsedMarkdown(Map.of(), normalizedText);
        }

        // Front Matter 的结束标志必须是独立的一行 ---
        String closingDelimiter = "\n" + FRONT_MATTER_DELIMITER + "\n";

        // closingDelimiterIndex标识结束---分隔符的位置
        // 从开头分隔符之后（FRONT_MATTER_DELIMITER.length() + 1）开始查找，避免把第一个 --- 当成结束位置
        int closingDelimiterIndex = normalizedText.indexOf(
                closingDelimiter,
                FRONT_MATTER_DELIMITER.length() + 1
        );

        // 如果已经存在开始分隔符，却没有结束分隔符，说明文档格式有误
        if (closingDelimiterIndex < 0) {
            throw new IllegalArgumentException(
                    "Markdown Front Matter 缺少结束分隔符"
            );
        }

        // yamlStartIndex标识yaml开始的位置
        // YAML 从开头的 "---\n" 之后开始，+1是换行符\n
        int yamlStartIndex = FRONT_MATTER_DELIMITER.length() + 1;
        // bodyStartIndex 标识正文开始的位置
        // 正文从结束分隔符之后开始
        int bodyStartIndex = closingDelimiterIndex + closingDelimiter.length();

        // yamlText 是从 yamlStartIndex 开始，到 closingDelimiterIndex 结束，中间的部分。
        String yamlText = normalizedText.substring(
                yamlStartIndex,
                closingDelimiterIndex
        );
        // 使用 Yaml 解析 yamlText，得到一个 Map<String, Object> 类型的 metadata。
        Yaml yaml = new Yaml();
        Object loadedMetadata = yaml.load(yamlText);

        // 判断---内部信息是否为标准的“键: 值”形式的 YAML 对象
        if (!(loadedMetadata instanceof Map<?, ?> rawMetadata)) {
            throw new IllegalArgumentException(
                    "Markdown Front Matter 必须是 YAML 对象"
            );
        }

        // 提取yaml对象中的键值对作为文档的元数据
        Map<String, Object> metadata = new LinkedHashMap<>();

        // 遍历yaml对象中的键值对，将键值对添加到metadata中
        for (Map.Entry<?, ?> entry : rawMetadata.entrySet()) {
            if (!(entry.getKey() instanceof String key)) {
                throw new IllegalArgumentException(
                        "Markdown Front Matter 的元数据名称必须是字符串"
                );
            }

            metadata.put(key, entry.getValue());
        }


        // body表示markdown正文
        String body = normalizedText.substring(bodyStartIndex);

        return new ParsedMarkdown(metadata, body);
    }

    /**
     * 加载多篇 Markdown 文档
     * @return allDocuments 所有文档
     */
    public List<Document> loadMarkdowns() {
        // 文档列表
        List<Document> allDocuments = new ArrayList<>();

        // 加载多篇文档
        try {
            // 加载本地客服知识库下所有 Markdown 文档，不加载计划上传到云知识库的作者信息
            Resource[] resources = resourcePatternResolver.getResources("classpath*:rag/customer-service/local/**/*.md");
            for (Resource resource : resources) {
                // 读取文件内容
                String rawText = resource.getContentAsString(
                        StandardCharsets.UTF_8
                );
                // 将带yaml头的md文件内容解析为文件体和文件头
                ParsedMarkdown parsedMarkdown = parseFrontMatter(rawText);
                // 将文件体转换为字节数组资源
                Resource bodyResource = new ByteArrayResource(
                        parsedMarkdown.body().getBytes(StandardCharsets.UTF_8)
                );

                String filename = resource.getFilename();

                // 配置MarkdownDocumentReader
                MarkdownDocumentReaderConfig config = MarkdownDocumentReaderConfig.builder()
                        // 遇到 Markdown 的水平分隔线（---）时，把内容切分成多个子文档。
                        .withHorizontalRuleCreateDocument(true)
                        // 不把代码块（```）纳入文档内容（客服文档通常不需要代码）。
                        .withIncludeCodeBlock(false)
                        // 不纳入引用块（>）。
                        .withIncludeBlockquote(false)
                        // 元数据（metadata）会随 Document 一起保存，后续做向量检索/过滤时非常有用。
                        // 将文件名和md文件的yaml头部作为元数据保存。
                        .withAdditionalMetadata(parsedMarkdown.metadata())
                        .withAdditionalMetadata("filename", filename)
                        .build();
                MarkdownDocumentReader markdownDocumentReader = new MarkdownDocumentReader(bodyResource, config);
                allDocuments.addAll(markdownDocumentReader.get());
            }
        } catch (IOException e) {
            log.error("Markdown 文档加载失败", e);
        }
        return allDocuments;
    }
}
