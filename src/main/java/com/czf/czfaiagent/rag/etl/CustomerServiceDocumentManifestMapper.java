package com.czf.czfaiagent.rag.etl;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Manifest 数据库映射器。
 *
 * 只负责声明数据库操作，
 * 具体 SQL 统一写在 resources/mapper 下的 XML 文件中。
 */
@Mapper
public interface CustomerServiceDocumentManifestMapper {

    /**
     * 查询所有处于 ACTIVE 状态的 Manifest。
     */
    List<CustomerServiceDocumentManifest> findAllActive();

    /**
     * 新增或更新一条 Manifest。
     */
    int save(CustomerServiceDocumentManifest manifest);

    /**
     * 将文档标记为 DELETED。
     */
    int markDeleted(
            @Param("sourceId") String sourceId,
            @Param("updatedAt") OffsetDateTime updatedAt
    );
}