package com.czf.czfaiagent.rag;

import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;



class CustomerServiceDocumentLoaderTest {

    private final CustomerServiceDocumentLoader documentLoader =

            new CustomerServiceDocumentLoader(
                    // 使用 PathMatchingResourcePatternResolver 来加载本地 Markdown 文件
                    new PathMatchingResourcePatternResolver()
            );

    /**
     * 测试：
     * 1. 本地知识库路径必须至少加载出一个 Spring AI Document。
     * 2. Document 正文不能包含 Front Matter。
     * 3. 每个正文切片必须继承 Front Matter 元数据。
     * 4. 本地加载器不能加载云知识库文档。
     */
    @Test
    void shouldLoadLocalMarkdownDocuments() {
        List<Document> documents = documentLoader.loadMarkdowns();

        // 1.本地知识库路径必须至少加载出一个 Spring AI Document。
        assertFalse(documents.isEmpty());

        // 2.当前 Document 的正文中不能包含 document_id:。
        boolean frontMatterExcluded = documents.stream()
                .noneMatch(document ->
                        document.getText().contains("document_id:")
                );

        assertTrue(frontMatterExcluded);

        // 3.每一个正文切片都应该继承原始 Markdown 的 Front Matter 元数据
        boolean frontMatterAttachedToMetadata = documents.stream()
                .allMatch(document ->
                        document.getMetadata().containsKey("document_id")
                                && document.getMetadata().containsKey("knowledge_source")
                );

        assertTrue(frontMatterAttachedToMetadata);

        // 4.本地加载器不能加载计划由云知识库管理的作者公开信息
        boolean cloudKnowledgeExcluded = documents.stream()
                // 字符串.equals()避免空指针异常
                .noneMatch(document ->
                        "cloud-public-author-info".equals(
                                document.getMetadata().get("knowledge_source")
                        )
                );

        assertTrue(cloudKnowledgeExcluded);
    }

    /**
    *  测试：Windows 换行格式下，所有功能仍正常
    */
    @Test
    void shouldParseFrontMatterWithWindowsLineEndings() throws IOException {
        String markdown = """
            ---
            document_id: test-windows-line-endings
            knowledge_source: local-test
            ---
            # 测试文档

            这是正文。
            """.replace("\n", "\r\n");

        // 将字符串包装为内存资源
        Resource markdownResource = new ByteArrayResource(
                markdown.getBytes(StandardCharsets.UTF_8)
        ) {
            @Override
            public String getFilename() {
                return "windows-line-endings.md";
            }
        };

        // 把markdown解析器换成可控的 Mock。
        ResourcePatternResolver resourcePatternResolver =
                mock(ResourcePatternResolver.class);
        // 当加载器查询本地知识库路径时，不要访问真实目录，直接返回这个测试文档。
        when(resourcePatternResolver.getResources(
                "classpath*:rag/customer-service/local/**/*.md"
        )).thenReturn(new Resource[]{markdownResource});


        CustomerServiceDocumentLoader loader =
                new CustomerServiceDocumentLoader(
                        resourcePatternResolver
                );

        List<Document> documents = loader.loadMarkdowns();

        assertFalse(documents.isEmpty());

        boolean metadataParsed = documents.stream()
                .allMatch(document ->
                        "test-windows-line-endings".equals(
                                document.getMetadata().get("document_id")
                        )
                );

        assertTrue(metadataParsed);

        boolean frontMatterExcluded = documents.stream()
                .noneMatch(document ->
                        document.getText().contains("document_id:")
                );

        assertTrue(frontMatterExcluded);
    }


}