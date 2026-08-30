一、RAG 核心特性
这一小节我؜؜؜们更多的是了解 RAG 的核心特性，重理论轻实战，下一小؜节会更؜注重实战。

还记得上节教程中，我们讲到的 RAG 工作流程么？


上节教程中我们只是؜؜؜按照这个流程完成了入门级 RAG 应用的开发，实际上每个流程都有一些值得学习的特性，Spring AI 也为这些流程的技术实现提供了支持؜؜؜，下面让我们按照流程依次进行讲解。

文档收集和切割
向量转换和存储
文档过滤和检索
查询增强和关联
文档收集和切割 - ETL
文档收集和切割阶段，我们要对自己准备好的知识库文档进行处理，然后保存到向量数据库中。这个过程俗称 ETL（抽取、转换、加载），Spring AI 提供了对 ETL 的支持，参考 官方文档。

文档
什么是 Spring AI 中的文档呢？q0QFh04ojOmf5nf+DDKEzdUBVWU8mYdSM92AhUCBteM=

文档不仅仅包含文本，还可以包含一系列元信息和多媒体附件：



ETL
在 Spr؜؜؜ing AI 中，对 Document 的处理通常遵循以؜下流程：

读取文档：使用 DocumentReader 组件从数据源（如本地文件、网络资源、数据库等）加载文档。
转换文档：根据需求将文档转换为适合后续处理的格式，比如去除冗余信息、分词、词性标注等，可以使用 DocumentTransformer 组件实现。
写入文档：使用 DocumentWriter 将文档以特定格式保存到存储中，比如将文档以嵌入向量的形式写入到向量数据库，或者以键值对字符串的形式保存到 Redis 等 KV 存储中。
流程如图：BkE91Qtrda4pWq2P879PsgCOBSJ8VEJ53LP4Ss2XyZI=



我们利用 Spr؜؜؜ing AI 实现 ETL，核心就是要学习 DocumentReader、DocumentTransformer、Documen؜؜؜tWriter 三大组件。

完整的 E؜؜؜TL 类图如下，先简单了解一下即可，下面分别来详细讲解这؜ 3 大؜组件：2ij1BoCbn6L80nfuuPB34meIKCLKFF/OnjoHYhf4jcY=



抽取（Extract）
Sprin؜؜g ؜AI 通过 DocumentReader 组件实现文档抽取，也就是把؜؜文档加载到内存中。؜XhHJOVrU+BgDv+oT8noKY0w/viRl7JoaW1LI8HsK/EU=

看下源码，DocumentReader 接口实现了 Supplier<List<Document>> 接口，主要负责从各种数据源读取数据并转换为 Document 对象集合。

▼
java
复制代码
public interface DocumentReader extends Supplier<List<Document>> {
default List<Document> read() {
return get();
}
}
实际开发中，我们可以直接使用 Spring AI 内置的多种 DocumentReader 实现类，用于处理不同类型的数据源：HzWieexUmpKM2YjDZiWyyfkUYLTOdhSRoY3JKDchydc=

JsonReader：读取 JSON 文档
TextReader：读取纯文本文件
MarkdownReader：读取 Markdown 文件
PDFReader：读取 PDF 文档，基于 Apache PdfBox 库实现
PagePdfDocumentReader：按照分页读取 PDF
ParagraphPdfDocumentReader：按照段落读取 PDF
HtmlReader：读取 HTML 文档，基于 jsoup 库实现
TikaDocumentReader：基于 Apache Tika 库处理多种格式的文档，更灵活
以 Json؜؜؜Reader 为例，支持 JSON Pointers 特性，能够快速指定从 JSON 文؜؜؜档中提取哪些字段和内容：

▼
java
复制代码
// 从 classpath 下的 JSON 文件中读取文档
@Component
class MyJsonReader {
private final Resource resource;

     MyJsonReader(@Value("classpath:products.json") Resource resource) {
         this.resource = resource;
     }

     // 基本用法
     List<Document> loadBasicJsonDocuments() {
         JsonReader jsonReader = new JsonReader(this.resource);
         return jsonReader.get();
     }

     // 指定使用哪些 JSON 字段作为文档内容
     List<Document> loadJsonWithSpecificFields() {
         JsonReader jsonReader = new JsonReader(this.resource, "description", "features");
         return jsonReader.get();
     }

     // 使用 JSON 指针精确提取文档内容
     List<Document> loadJsonWithPointer() {
         JsonReader jsonReader = new JsonReader(this.resource);
         return jsonReader.get("/items"); // 提取 items 数组内的内容
     }
}
更多的文档读取器等用到的时候再了解用法即可。W2VjBmYkJVqSdEjUH0qzIpBg+EYq8E+v0WddTYs3uW0=

此外，Spring AI Alibaba 官方社区提供了 更多的文档读取器，比如加载飞书文档、提取 B 站视频信息和字幕、加载邮件、加载 GitHub 官方文档、加载数据库等等。

💡 思考؜؜؜：如果让你自己实现一个 DocumentReader 组؜件，你会؜怎么实现؜呢？BkE91Qtrda4pWq2P879PsgCOBSJ8VEJ53LP4Ss2XyZI=

当然是先看官方 开源的代码仓库 ，看看大佬们是怎么实现的：



比如一个邮؜؜؜件文档读取器的实现其实并不难，核心代码就是解析邮件文档并且转换为 Doc؜؜؜ument 列表：XhHJOVrU+BgDv+oT8noKY0w/viRl7JoaW1LI8HsK/EU=



邮件解析器的实现：

▼
java
复制代码
public class MsgEmailParser {

    private MsgEmailParser() {
        // Private constructor to prevent instantiation
    }

    /**
     * Convert MsgEmailElement to Document
     * @param element MSG email element
     * @return Document object
     */
    public static Document convertToDocument(MsgEmailElement element) {
        if (element == null) {
            throw new IllegalArgumentException("MsgEmailElement cannot be null");
        }

        // Build metadata
        Map<String, Object> metadata = new HashMap<>();

        // Add metadata with null check
        if (StringUtils.hasText(element.getSubject())) {
            metadata.put("subject", element.getSubject());
        }
    
    // ... 省略更多元信息的设置

        // Create Document object with content null check
        String content = StringUtils.hasText(element.getText()) ? element.getText() : "";
        return new Document(content, metadata);
    }

}
转换（Transform）
Sprin؜؜؜g AI 通过 DocumentTransformer ؜组件实现文؜档转换؜。

看下源码，DocumentTransformer 接口实现了 Function<List<Document>, List<Document>> 接口，负责将一组文档转换为另一组文档。BHyZb/ExBBVHN/Ygi2BTe+AuPRTUcLO/N/zsCycwIV8=

▼
java
复制代码
public interface DocumentTransformer extends Function<List<Document>, List<Document>> {
default List<Document> transform(List<Document> documents) {
return apply(documents);
}
}
文档转换是保证 R؜؜؜AG 效果的核心步骤，也就是如何将大文档合理拆分为便于检索的知识碎片，Spring AI 提供了多种 DocumentTransformer 实؜؜؜现类，可以简单分为 3 类。

1）TextSplitter 文本分割器
其中 Te؜؜؜xtSplitter 是文本分割器的基类，提供了分割单词؜的流程方؜法：



TokenTex؜؜؜tSplitter 是其实现类，基于 Token 的文本分割器。它考虑了语义边界（比如句子结尾）来创建有意义的文本段落，؜؜؜是成本较低的文本切分方式。bAZLrTx+axNBeqFIfzSmr3uIbj7WYFJMq7nZV65CkQg=

▼
java
复制代码
@Component
class MyTokenTextSplitter {

    public List<Document> splitDocuments(List<Document> documents) {
        TokenTextSplitter splitter = new TokenTextSplitter();
        return splitter.apply(documents);
    }

    public List<Document> splitCustomized(List<Document> documents) {
        TokenTextSplitter splitter = new TokenTextSplitter(1000, 400, 10, 5000, true);
        return splitter.apply(documents);
    }
}
Token؜؜؜TextSplitter 提供了两种构造函数选项：

TokenTextSplitter()：使用默认设置创建分割器。
TokenTextSplitter(int defaultChunkSize, int minChunkSizeChars, int minChunkLengthToEmbed, int maxNumChunks, boolean keepSeparator)：使用自定义参数创建分割器，通过调整参数，可以控制分割的粒度和方式，适应不同的应用场景。
参数说明（无需记忆）：

defaultChunkSize：每个文本块的目标大小（以 token 为单位，默认值：800）。
minChunkSizeChars：每个文本块的最小大小（以字符为单位，默认值：350）。
minChunkLengthToEmbed：要被包含的块的最小长度（默认值：5）。
maxNumChunks：从文本中生成的最大块数（默认值：10000）。
keepSeparator：是否在块中保留分隔符（如换行符）（默认值：true）。
官方文档有؜؜؜对 Token 分词器工作原理的详细解释，可以简单了解下؜：HzWieexUmpKM2YjDZiWyyfkUYLTOdhSRoY3JKDchydc=

使用 CL100K_BASE 编码将输入文本编码为 token。
根据 defaultChunkSize 将编码后的文本分割成块。
对于每个块：
将块解码回文本。
尝试在 minChunkSizeChars 之后找到合适的断点（句号、问号、感叹号或换行符）。
如果找到断点，则在该点截断块。
修剪块并根据 keepSeparator 设置选择性地删除换行符。
如果生成的块长度大于 minChunkLengthToEmbed，则将其添加到输出中。
这个过程会一直持续到所有 token 都被处理完或达到 maxNumChunks 为止。
如果剩余文本长度大于 minChunkLengthToEmbed，则会作为最后一个块添加。
2）MetadataEnricher 元数据增强器
元数据增强؜؜؜器的作用是为文档补充更多的元信息，便于后续检索，而不是改变文档本؜؜身的؜切分规则。包括：

KeywordMetadataEnricher：使用 AI 提取关键词并添加到元数据
SummaryMetadataEnricher：使用 AI 生成文档摘要并添加到元数据。不仅可以为当前文档生成摘要，还能关联前一个和后一个相邻的文档，让摘要更完整。
示例代码：

▼
java
复制代码
@Component
class MyDocumentEnricher {

    private final ChatModel chatModel;

    MyDocumentEnricher(ChatModel chatModel) {
        this.chatModel = chatModel;
    }
      
      // 关键词元信息增强器
    List<Document> enrichDocumentsByKeyword(List<Document> documents) {
        KeywordMetadataEnricher enricher = new KeywordMetadataEnricher(this.chatModel, 5);
        return enricher.apply(documents);
    }
  
    // 摘要元信息增强器
    List<Document> enrichDocumentsBySummary(List<Document> documents) {
        SummaryMetadataEnricher enricher = new SummaryMetadataEnricher(chatModel, 
            List.of(SummaryType.PREVIOUS, SummaryType.CURRENT, SummaryType.NEXT));
        return enricher.apply(documents);
    }
}
3）ContentFormatter 内容格式化工具
用于统一文؜؜؜档内容格式。官方对这个的介绍少的可怜，感觉像是个孤儿؜功能。。。

我们不妨看它的实现类 DefaultContentFormatter 的源码来了解他的功能：

XhHJOVrU+BgDv+oT8noKY0w/viRl7JoaW1LI8HsK/EU=

主要提供了 3 类功能：

文档格式化：将文档内容与元数据合并成特定格式的字符串，以便于后续处理。
元数据过滤：根据不同的元数据模式（MetadataMode）筛选需要保留的元数据项：
ALL：保留所有元数据
NONE：移除所有元数据
INFERENCE：用于推理场景，排除指定的推理元数据
EMBED：用于嵌入场景，排除指定的嵌入元数据
自定义模板：支持自定义以下格式：
元数据模板：控制每个元数据项的展示方式
元数据分隔符：控制多个元数据项之间的分隔方式
文本模板：控制元数据和内容如何结合
该类采用 Builder 模式创建实例，使用示例：HzWieexUmpKM2YjDZiWyyfkUYLTOdhSRoY3JKDchydc=

▼
java
复制代码
DefaultContentFormatter formatter = DefaultContentFormatter.builder()
.withMetadataTemplate("{key}: {value}")
.withMetadataSeparator("\n")
.withTextTemplate("{metadata_string}\n\n{content}")
.withExcludedInferenceMetadataKeys("embedding", "vector_id")
.withExcludedEmbedMetadataKeys("source_url", "timestamp")
.build();

// 使用格式化器处理文档
String formattedText = formatter.format(document, MetadataMode.INFERENCE);
在 RAG؜؜؜ 系统中，这个格式化器可以有下面的作用，了解即可：

提供上下文：将元数据（如文档来源、时间、标签等）与内容结合，丰富大语言模型的上下文信息
过滤无关信息：通过排除特定元数据，减少噪音，提高检索和生成质量
场景适配：为不同场景（如推理和嵌入）提供不同的格式化策略
结构化输出：为 AI 模型提供结构化的输入，使其能更好地理解和处理文档内容
加载（Load）
Sprin؜؜؜g AI 通过 DocumentWriter 组件实现文؜档加载؜（写入）。

DocumentWriter 接口实现了 Consumer<List<Document>> 接口，负责将处理后的文档写入到目标存储中：HzWieexUmpKM2YjDZiWyyfkUYLTOdhSRoY3JKDchydc=

▼
java
复制代码
public interface DocumentWriter extends Consumer<List<Document>> {
default void write(List<Document> documents) {
accept(documents);
}
}
Sprin؜؜؜g AI 提供了 2 种内置的 DocumentWrit؜er 实؜现：

1）Fil؜؜؜eDocumentWriter：将文档写入到文件系统2ij1BoCbn6L80nfuuPB34meIKCLKFF/OnjoHYhf4jcY=

▼
java
复制代码
@Component
class MyDocumentWriter {
public void writeDocuments(List<Document> documents) {
FileDocumentWriter writer = new FileDocumentWriter("output.txt", true, MetadataMode.ALL, false);
writer.accept(documents);
}
}
2）Vec؜؜؜torStoreWriter：将文档写入到向量数据库

▼
java
复制代码
@Component
class MyVectorStoreWriter {
private final VectorStore vectorStore;

    MyVectorStoreWriter(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }
    
    public void storeDocuments(List<Document> documents) {
        vectorStore.accept(documents);
    }
}
当然，你也؜؜؜可以同时将文档写入多个存储，只需要创建多个 Writer 或者自定义 W؜؜؜riter 即可。

ETL 流程示例
将上述 3 大组件组合起来，可以实现完整的 ETL 流程：2ij1BoCbn6L80nfuuPB34meIKCLKFF/OnjoHYhf4jcY=

▼
java
复制代码
// 抽取：从 PDF 文件读取文档
PDFReader pdfReader = new PagePdfDocumentReader("knowledge_base.pdf");
List<Document> documents = pdfReader.read();

// 转换：分割文本并添加摘要
TokenTextSplitter splitter = new TokenTextSplitter(500, 50);
List<Document> splitDocuments = splitter.apply(documents);

SummaryMetadataEnricher enricher = new SummaryMetadataEnricher(chatModel,
List.of(SummaryType.CURRENT));
List<Document> enrichedDocuments = enricher.apply(splitDocuments);

// 加载：写入向量数据库
vectorStore.write(enrichedDocuments);

// 或者使用链式调用
vectorStore.write(enricher.apply(splitter.apply(pdfReader.read())));
通过这种方؜؜؜式，我们完成了从原始文档到向量数据库的整个 ETL 过程，为后续的检索增؜؜؜强生成提供了基础。