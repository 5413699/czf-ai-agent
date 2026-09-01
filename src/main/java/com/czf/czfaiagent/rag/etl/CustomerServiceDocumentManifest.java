package com.czf.czfaiagent.rag.etl;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 一篇源知识文档的导入清单。
 *
 * Manifest 按源文档记录导入状态，
 * 而不是按单个向量切片记录。
 */
public record CustomerServiceDocumentManifest(
        String sourceId,
        String contentHash,
        List<String> vectorIds,
        int chunkCount,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}