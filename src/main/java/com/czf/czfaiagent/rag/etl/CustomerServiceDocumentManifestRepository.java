package com.czf.czfaiagent.rag.etl;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Manifest 持久化边界。
 *
 * Importer 只依赖这个接口，不直接编写 SQL。
 */
public interface CustomerServiceDocumentManifestRepository {

    /**
     * 查询所有当前有效的源文档。
     */
    List<CustomerServiceDocumentManifest> findAllActive();

    /**
     * 保存一篇文档的最新导入清单。
     */
    void save(CustomerServiceDocumentManifest manifest);

    /**
     * 将已经从本地知识库消失的文档标记为删除。
     */
    void markDeleted(
            String sourceId,
            OffsetDateTime updatedAt
    );
}