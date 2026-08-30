向量转换和存储
上一节教程中有介绍过，向量存储是 RAG 应用中的核心组件，它将文档转换为向量（嵌入）并存储起来，以便后续进行高效的相似性搜索。Spring AI 官方 提供了向量数据库接口 VectorStore 和向量存储整合包，帮助开发者快速集成各种第三方向量存储，比如 Milvus、Redis、PGVector、Elasticsearch 等。

VectorStore 接口介绍
VectorS؜؜؜tore 是 Spring AI 中用于与向量数据库交互的核心接口，它继承自 DocumentWrite؜؜؜r，主要提供以下功能：Pjvodm7bccPnZl/Xbe7wXsbkcOgqQPJX/ZJKzKdFnuQ=

▼
java
复制代码
public interface VectorStore extends DocumentWriter {

    default String getName() {
        return this.getClass().getSimpleName();
    }

    void add(List<Document> documents);

    void delete(List<String> idList);

    void delete(Filter.Expression filterExpression);

    default void delete(String filterExpression) { ... };

    List<Document> similaritySearch(String query);

    List<Document> similaritySearch(SearchRequest request);

    default <T> Optional<T> getNativeClient() {
        return Optional.empty();
    }
}
这个接口定؜؜؜义了向量存储的基本操作，简单来说就是 “增删改查”：

添加文档到向量库
从向量库删除文档
基于查询进行相似度搜索
获取原生客户端（用于特定实现的高级操作）
搜索请求构建
Sprin؜؜؜g AI 提供了 SearchRequest 类，用于构؜建相似度؜搜索请求؜：

▼
java
复制代码
SearchRequest request = SearchRequest.builder()
    .query("什么是程序员鱼皮的编程导航学习网 codefather.cn？")
    .topK(5)                  // 返回最相似的5个结果
    .similarityThreshold(0.7) // 相似度阈值，0.0-1.0之间
    .filterExpression("category == 'web' AND date > '2025-05-03'")  // 过滤表达式
    .build();

List<Document> results = vectorStore.similaritySearch(request);
SearchRequest 提供了多种配置选项：

query：搜索的查询文本
topK：返回的最大结果数，默认为4
similarityThreshold：相似度阈值，低于此值的结果会被过滤掉
filterExpression：基于文档元数据的过滤表达式，语法有点类似 SQL 语句，需要用到时查询 官方文档 了解语法即可
向量存储的工作原理
在向量数据库؜؜؜中，查询与传统关系型数据库有所不同。向量库执行的是相似性搜索，而非精确匹配，具体流程我们在上一节؜؜؜教程中有了解，可以再复习下。

嵌入转换：当文档被添加到向量存储时，Spring AI 会使用嵌入模型（如 OpenAI 的 text-embedding-ada-002）将文本转换为向量。
相似度计算：查询时，查询文本同样被转换为向量，然后系统计算此向量与存储中所有向量的相似度。
相似度度量：常用的相似度计算方法包括：
余弦相似度：计算两个向量的夹角余弦值，范围在-1到1之间
欧氏距离：计算两个向量间的直线距离
点积：两个向量的点积值
过滤与排序：根据相似度阈值过滤结果，并按相似度排序返回最相关的文档
支持的向量数据库
Spring AI 支持多种向量数据库实现，包括：XhHJOVrU+BgDv+oT8noKY0w/viRl7JoaW1LI8HsK/EU=



对于每种 Vecto؜؜؜r Store 实现，我们都可以参考对应的官方文档进行整合，开发方法基本上一致：先准备好数据源 => 引入不同的整合包 => 编写对应的配置 => 使用自动注入؜؜؜的 VectorStore 即可。

值得一提的是，S؜؜؜pring AI Alibaba 已经集成了阿里云百炼平台，可以直接使用阿里云百炼平台提供的 VectorStore API，无؜؜؜需自己再搭建向量数据库了。W2VjBmYkJVqSdEjUH0qzIpBg+EYq8E+v0WddTYs3uW0=

参考 官方文档，主要是提供了 DashScopeCloudStore 类：



DashSco؜؜؜peCloudStore 类实现了 VectorStore 接口，通过调用 DashScope API 来使用阿؜؜؜里云提供的远程向量存储：bAZLrTx+axNBeqFIfzSmr3uIbj7WYFJMq7nZV65CkQg=



基于 PGVector 实现向量存储
PGVect؜؜؜or 是经典数据库 PostgreSQL 的扩展，为 PostgreSQL 提供了存储和؜؜؜检索高维向量数据的能力。HzWieexUmpKM2YjDZiWyyfkUYLTOdhSRoY3JKDchydc=

为什么选择它来实现向量存؜؜؜储呢？因为很多传统业务都会把数据存储在这种关系型数据库中，直接给原有的数据库安装扩展就能实现向量相似度搜索、而不需要额外搞一套向量数据库，人力物力成本都很低，所以这种方案很受企业青睐，؜؜؜也是目前实现 RAG 的主流方案之一。

首先我们准备؜؜؜ PostgreSQL 数据库，并为其添加扩展。有 2 种方式，第一种是在自己的本地或服务器安装؜؜؜，可以参考下列文章实现：

Linux服务器快速安装PostgreSQL 15与pgvector向量插件实践
宝塔 PostgreSQL 安装 pgvector 插件实现向量存储
这里由于大؜؜؜家更多的是为了学习，我们采用更方便的方式 —— 使用现成的云数据؜؜库，下面؜我们来实操下~

1）首先打开 阿里云 PostgreSQL 官网，开通 Serverless 版本，按用量计费，对于学习来说性价比更高：


开通 Serverless 数据库服务，填写配置：


2）开通成功后，进入控制台，先创建账号：


然后创建数据库：BkE91Qtrda4pWq2P879PsgCOBSJ8VEJ53LP4Ss2XyZI=


进入插件管理，安装 vector 插件：


进入数据库连接，开通公网访问地址：


可以在本地؜؜؜使用 IDEA 自带的数据库管理工具，进行连接测试：W2VjBmYkJVqSdEjUH0qzIpBg+EYq8E+v0WddTYs3uW0=

如果你的 ؜؜؜IDEA 版本没有这个工具，也不用纠结，直接在云平台查看؜管理数据؜库即可


显示连接成功，至此数据库准备完成：BHyZb/ExBBVHN/Ygi2BTe+AuPRTUcLO/N/zsCycwIV8=


3）参考 Spring AI 官方文档 整合 PGVector，先引入依赖，版本号可以在 Maven 中央仓库 查找：

▼
xml
复制代码
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-vector-store-pgvector</artifactId>
    <version>1.0.0-M7</version>
</dependency>
编写配置，建立数据库连接：

▼
yaml
复制代码
spring:
  datasource:
    url: jdbc:postgresql://改为你的公网地址/yu_ai_agent
    username: 改为你的用户名
    password: 改为你的密码
  ai:
    vectorstore:
      pgvector:
        index-type: HNSW
        dimensions: 1536
        distance-type: COSINE_DISTANCE
        max-document-batch-size: 10000 # Optional: Maximum number of documents per batch
注意，在不确定向量维度的情况下，一定不要指定 dimensions 配置！否则很可能会报错！q0QFh04ojOmf5nf+DDKEzdUBVWU8mYdSM92AhUCBteM=

如果未明确指定，PgVe؜؜؜ctorStore 将从提供的 EmbeddingModel 中检索维度，维度在表创建时设置为嵌入列。如果更改维度，则必须重新创建 Vector_store 表。不过最好提前明确你要使؜؜؜用的嵌入维度值，手动建表，更可靠一些。

正常情况下؜؜؜，接下来就可以使用自动注入的 VectorStore 了؜，系统会؜自动创建؜库表：

▼
java
复制代码
@Autowired
VectorStore vectorStore;

// ...

List<Document> documents = List.of(
    new Document("Spring AI rocks!! Spring AI rocks!! Spring AI rocks!! Spring AI rocks!! Spring AI rocks!!", Map.of("meta1", "meta1")),
    new Document("The World is Big and Salvation Lurks Around the Corner"),
    new Document("You walk forward facing the past and you turn back toward the future.", Map.of("meta2", "meta2")));

// Add the documents to PGVector
vectorStore.add(documents);

// Retrieve documents similar to a query
List<Document> results = this.vectorStore.similaritySearch(SearchRequest.builder().query("Spring").topK(5).build());
但是，这种方式不适合我们现在؜؜؜的项目！因为 VectorStore 依赖 EmbeddingModel 对象，咱们之前的学习中同时引入了 Ollama 和 阿里云 Dashscope 的依赖，有两个 EmbeddingModel 的 Bean，Sprin؜؜؜g 不知道注入哪个，就会报下面这种错误：


4）所以让؜؜؜我们换一种更灵活的方式来初始化 VectorStore。؜先引入 ؜3 个依؜赖：HzWieexUmpKM2YjDZiWyyfkUYLTOdhSRoY3JKDchydc=

▼
xml
复制代码
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-pgvector-store</artifactId>
    <version>1.0.0-M6</version>
</dependency>
然后编写配؜؜؜置类自己构造 PgVectorStore，不用 Star؜ter ؜自动注入؜：

▼
java
复制代码
@Configuration
public class PgVectorVectorStoreConfig {

    @Bean
    public VectorStore pgVectorVectorStore(JdbcTemplate jdbcTemplate, EmbeddingModel dashscopeEmbeddingModel) {
        VectorStore vectorStore = PgVectorStore.builder(jdbcTemplate, dashscopeEmbeddingModel)
                .dimensions(1536)                    // 不要盲目设置
                .distanceType(COSINE_DISTANCE)       // Optional: defaults to COSINE_DISTANCE
                .indexType(HNSW)                     // Optional: defaults to HNSW
                .initializeSchema(true)              // Optional: defaults to false
                .schemaName("public")                // Optional: defaults to "public"
                .vectorTableName("vector_store")     // Optional: defaults to "vector_store"
                .maxDocumentBatchSize(10000)         // Optional: defaults to 10000
                .build();
        return vectorStore;
    }
}
💡 注意，在不确定向量维度的情况下，一定不要指定 dimensions 配置！否则很可能会报错！ 如果你想使用特定的 Embedding 模型，必须到模型官网查看文档来了解模型支持的向量维度。

并且启动类要排除掉自动加载，否则也会报错：

▼
java
复制代码
@SpringBootApplication(exclude = PgVectorStoreAutoConfiguration.class)
public class YuAiAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(YuAiAgentApplication.class, args);
    }

}
5）编写单元测试类，验证效果：

▼
java
复制代码
@SpringBootTest
public class PgVectorVectorStoreConfigTest {

    @Resource
    VectorStore pgVectorVectorStore;

    @Test
    void test() {
        List<Document> documents = List.of(
                new Document("Spring AI rocks!! Spring AI rocks!! Spring AI rocks!! Spring AI rocks!! Spring AI rocks!!", Map.of("meta1", "meta1")),
                new Document("The World is Big and Salvation Lurks Around the Corner"),
                new Document("You walk forward facing the past and you turn back toward the future.", Map.of("meta2", "meta2")));
        // 添加文档
        pgVectorVectorStore.add(documents);
        // 相似度查询
        List<Document> results = pgVectorVectorStore.similaritySearch(SearchRequest.builder().query("Spring").topK(5).build());
        Assertions.assertNotNull(results);
    }
}
以 Deb؜؜؜ug 模式运行，可以看到文档检索成功，并且给出了相似度得分：                    ؜            XhHJOVrU+BgDv+oT8noKY0w/viRl7JoaW1LI8HsK/EU=


查看此时的؜؜数据库表，有 3 条数据：                       ؜؜         


查看自动创؜؜؜建的数据表结构，embedding 字段是 vector؜ 类型：


至此，我们的؜؜؜ PGVectorStore 就整合成功了。你可以用它来替换原本的本地 VectorStore，自؜行؜؜测试即可。示例代码如下：XhHJOVrU+BgDv+oT8noKY0w/viRl7JoaW1LI8HsK/EU=

▼
java
复制代码
@Configuration
public class PgVectorVectorStoreConfig {

    @Resource
    private LoveAppDocumentLoader loveAppDocumentLoader;

    @Bean
    public VectorStore pgVectorVectorStore(JdbcTemplate jdbcTemplate, EmbeddingModel dashscopeEmbeddingModel) {
        VectorStore vectorStore = PgVectorStore.builder(jdbcTemplate, dashscopeEmbeddingModel)
                .dimensions(1536)                    // Optional: defaults to model dimensions or 1536
                .distanceType(COSINE_DISTANCE)       // Optional: defaults to COSINE_DISTANCE
                .indexType(HNSW)                     // Optional: defaults to HNSW
                .initializeSchema(true)              // Optional: defaults to false
                .schemaName("public")                // Optional: defaults to "public"
                .vectorTableName("vector_store")     // Optional: defaults to "vector_store"
                .maxDocumentBatchSize(10000)         // Optional: defaults to 10000
                .build();
        // 加载文档
        List<Document> documents = loveAppDocumentLoader.loadMarkdowns();
        vectorStore.add(documents);
        return vectorStore;
    }
}
注意，有些؜؜؜ Embedding 模型可能有加载文档的单批数量限制，这时你可以通过 ؜؜؜for 循环分为多批插入。

▼
java
复制代码
@Bean
public VectorStore pgVectorVectorStore(JdbcTemplate jdbcTemplate, EmbeddingModel dashscopeEmbeddingModel) {
    ...
    // 加载文档，分批添加（DashScope Embedding API 限制单次 batch size 不超过 10）
    List<Document> documents = loveAppDocumentLoader.loadMarkdowns();
    int batchSize = 10;
    for (int i = 0; i < documents.size(); i += batchSize) {
        int end = Math.min(i + batchSize, documents.size());
        vectorStore.add(documents.subList(i, end));
    }
    return vectorStore;
}
鱼皮测试下来，效果还是不错的：



扩展知识 - 批处理策略
在使用向量؜؜؜存储时，可能要嵌入大量文档，如果一次性处理存储大量文档，可能会导致性能问题、甚至؜؜؜出现错误导致数据不完整。

举个例子，嵌入模型؜؜؜一般有一个最大标记限制，通常称为上下文窗口大小（context window size），限制了单个嵌入请求中可以处理的文本量。如果在一次调用中؜؜؜转换过多文档可能直接导致报错。

为此，Spring؜؜؜ AI 实现了批处理策略（Batching Strategy），将大量文档分解为较小的批次，使其适合嵌入模型的最大上下文窗口，还可以提高性能并更؜؜؜有效地利用 API 速率限制。2ij1BoCbn6L80nfuuPB34meIKCLKFF/OnjoHYhf4jcY=

Spring؜؜؜ AI 通过 BatchingStrategy 接口提供该功能，该接口允许基于文档的标记؜؜؜计数并以分批方式处理文档：

▼
java
复制代码
public interface BatchingStrategy {
    List<List<Document>> batch(List<Document> documents);
}
该接口定义了一个单一方法 batch，它接收一个文档列表并返回一个文档批次列表。bAZLrTx+axNBeqFIfzSmr3uIbj7WYFJMq7nZV65CkQg=

Spring AI 提供了一؜؜؜个名为 TokenCountBatchingStrategy 的默认实现。这个策略为每个文档估算 token 数，将文档分组到不超过最大输入 token 数的批次中，如果单个文档超过此限制，则抛出异常。这样就确保了每个批次不؜؜؜超过计算出的最大输入 token 数。

可以自定义؜؜؜ TokenCountBatchingStrategy，؜示例代码؜：

▼
java
复制代码
@Configuration
public class EmbeddingConfig {
    @Bean
    public BatchingStrategy customTokenCountBatchingStrategy() {
        return new TokenCountBatchingStrategy(
            EncodingType.CL100K_BASE,  // 指定编码类型
            8000,                      // 设置最大输入标记计数
            0.1                        // 设置保留百分比
        );
    }
}
当然，除了؜؜؜使用默认策略外，也可以自己实现 BatchingStra؜tegy؜：

▼
java
复制代码
@Configuration
public class EmbeddingConfig {
    @Bean
    public BatchingStrategy customBatchingStrategy() {
        return new CustomBatchingStrategy();
    }
}
比如你使用的向؜؜؜量数据库每秒只能插入 1 万条数据，就可以通过自实现 BatchingStrategy 控制速率，还可以؜؜؜进行额外的日志记录和异常处理。