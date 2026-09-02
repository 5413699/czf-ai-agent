package com.czf.czfaiagent.rag.etl;

import org.springframework.ai.document.Document;

import java.util.List;

/**
 * 一篇客服知识源文档及其生成的向量切片。
 */
public record CustomerServiceSourceDocument(
        String sourceId,
        String filename,
        String contentHash,
        List<Document> chunks
) {
}