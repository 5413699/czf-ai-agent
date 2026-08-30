# 时栈小助手 RAG 文档说明

本目录存放时栈客服的首期知识文档。文档分为三个知识源：

- `local/website-guide/`：由项目维护的网站操作知识，部署到自有服务。
- `local/pomodoro-method/`：经过来源筛选的番茄工作法常识、实践建议和研究证据。
- `cloud/public-author-info/`：允许上传到云知识库的作者与项目公开信息。

`catalog.yml` 是入库清单，不参与面向用户的语义检索。正文 Markdown 才是检索内容。

## 元数据约定

每篇可入库文档使用 YAML Front Matter：

- `document_id`：长期稳定且唯一的文档标识；更新正文时不要修改。
- `document_type`：`concept`、`operation-guide`、`troubleshooting`、`faq` 或 `public-info`。
- `knowledge_source`：用于知识源路由。
- `module`：功能模块，可用于检索过滤。
- `app_version`：文档适用版本。
- `platform`：`all`、`desktop`、`mobile` 或列表。
- `updated_at`：内容最后核验日期，格式为 `YYYY-MM-DD`。
- `content_public`：内容是否允许客服转述给用户。
- `raw_document_public`：是否允许直接返回知识库原文或内部文档地址。
- `allow_contact_disclosure`：联系方式是否允许公开，仅用于联系人文档。
- `tags`、`aliases`：召回关键词和常见问法，不替代正文。
- `source_tier`：来源等级，`primary` 为原作者或原始论文，`secondary` 为百科或整理站点，`mixed` 为多等级来源综合。
- `evidence_level`：内容证据属性，区分方法定义、实践建议和有限实证结果。

## 入库与切片建议

1. 解析 Front Matter，并将元数据作为独立字段保存，不要拼入回答正文。
2. 首期按二级标题切片；三级标题随所属二级标题一起保留。
3. 每个切片重复携带 `document_id`、`title`、`module`、`app_version`、`updated_at` 和访问控制字段。
4. 不跨文档合并切片。建议单片约 300 至 700 个中文字符，并保留约 60 至 100 个字符重叠。
5. 先按问题类型路由知识源，再检索；作者信息问题只检索云公开信息库，番茄工作法常识检索 `local/pomodoro-method/`。
6. 只允许生成 `content_public: true` 的内容。`raw_document_public: false` 时，可以转述答案和显示经过批准的来源标题，但不得返回内部文件路径、完整原文或切片。
7. 若检索不到与当前版本一致且可信的内容，应回答“当前资料中无法确认”，不能使用模型常识补齐网站功能。
8. 更新功能时先修改对应主题文档和 `updated_at`，再重新入库；弃用文档应从清单停用，不要仅在正文写“已过期”。
9. 对番茄工作法的效果提问，优先返回论文结论和研究限制；不得把方法官网或百科中的宣传性表述当成实验结论。

## 质量检查

- 一个文件只回答一个相对独立的主题。
- 操作类文档包含前置条件、编号步骤、预期结果和失败处理。
- 不使用“这里”“上面”“如下图”等依赖页面上下文的措辞。
- 不把界面占位、接口契约或规划能力描述为已可用功能。
- 不写入 API Key、知识库 ID、向量、切片内容或供应商内部配置。
- 联系方式只从明确允许公开的文档中回答。
