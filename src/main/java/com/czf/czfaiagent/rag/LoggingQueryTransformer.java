package com.czf.czfaiagent.rag;


import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.rag.Query;
import org.springframework.ai.rag.preretrieval.query.transformation.QueryTransformer;

@Slf4j
public class LoggingQueryTransformer
        implements QueryTransformer {

    private final QueryTransformer delegate;

    public LoggingQueryTransformer(
            QueryTransformer delegate
    ) {
        this.delegate = delegate;
    }

    @Override
    public Query transform(Query query) {
        Query transformedQuery =
                delegate.transform(query);

        log.info(
                "RAG query rewritten: original=[{}], rewritten=[{}]",
                query.text(),
                transformedQuery.text()
        );

        return transformedQuery;
    }
}