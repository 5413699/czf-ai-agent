package com.czf.czfaiagent.rag.etl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.postgresql.util.PGobject;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * MyBatis 对 PostgreSQL JSONB vector_ids 的类型转换器。
 *
 * Java:
 *     List<String>
 *
 * PostgreSQL:
 *     JSONB
 */
public class CustomerServiceVectorIdsTypeHandler
        extends BaseTypeHandler<List<String>> {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void setNonNullParameter(
            PreparedStatement preparedStatement,
            int parameterIndex,
            List<String> vectorIds,
            JdbcType jdbcType
    ) throws SQLException {
        try {
            PGobject jsonObject = new PGobject();
            jsonObject.setType("jsonb");
            jsonObject.setValue(
                    objectMapper.writeValueAsString(vectorIds)
            );
            preparedStatement.setObject(parameterIndex, jsonObject);
        } catch (JsonProcessingException e) {
            throw new SQLException(
                    "vector_ids 无法转换为 JSON",
                    e
            );
        }
    }

    @Override
    public List<String> getNullableResult(
            ResultSet resultSet,
            String columnName
    ) throws SQLException {
        return parseJson(resultSet.getString(columnName));
    }

    @Override
    public List<String> getNullableResult(
            ResultSet resultSet,
            int columnIndex
    ) throws SQLException {
        return parseJson(resultSet.getString(columnIndex));
    }

    @Override
    public List<String> getNullableResult(
            CallableStatement callableStatement,
            int columnIndex
    ) throws SQLException {
        return parseJson(callableStatement.getString(columnIndex));
    }

    private List<String> parseJson(String json) throws SQLException {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(
                    json,
                    new TypeReference<List<String>>() {
                    }
            );
        } catch (JsonProcessingException e) {
            throw new SQLException(
                    "vector_ids 不是合法的 JSON 数组",
                    e
            );
        }
    }
}