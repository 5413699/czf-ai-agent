package com.czf.czfaiagent.rag.etl;

import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 基于 MyBatis 的 Manifest 仓储实现。
 *
 * Repository 对上层暴露业务持久化接口，
 * Mapper 负责具体 SQL 映射。
 */
@Repository
public class MyBatisCustomerServiceDocumentManifestRepository
        implements CustomerServiceDocumentManifestRepository {

    private final CustomerServiceDocumentManifestMapper mapper;

    public MyBatisCustomerServiceDocumentManifestRepository(
            CustomerServiceDocumentManifestMapper mapper
    ) {
        this.mapper = mapper;
    }

    @Override
    public List<CustomerServiceDocumentManifest> findAllActive() {
        return mapper.findAllActive();
    }

    @Override
    public void save(CustomerServiceDocumentManifest manifest) {
        mapper.save(manifest);
    }

    @Override
    public void markDeleted(
            String sourceId,
            OffsetDateTime updatedAt
    ) {
        mapper.markDeleted(sourceId, updatedAt);
    }
}