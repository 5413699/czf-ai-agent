---
document_id: website-guide-common-troubleshooting-v1
title: 页面、数据和 AI 服务常见问题排查
document_type: troubleshooting
knowledge_source: local-website-guide
module: common-troubleshooting
app_version: "1.0.0"
platform: all
language: zh-CN
updated_at: 2026-08-25
content_public: true
raw_document_public: false
tags: [常见问题, 页面空白, 数据丢失, AI离线, 后端不可用, 浏览器]
aliases: [网站打不开, 页面没反应, 数据不见了, AI服务不可用, 功能报错]
---

# 页面、数据和 AI 服务常见问题排查

## 前置条件

- 记录问题发生的页面、操作步骤、页面提示、设备和浏览器名称。

## 通用排查步骤

1. 确认问题属于普通本地功能还是需要后端的 AI、客服功能。
2. 普通页面异常时，刷新一次页面并重复最少操作步骤。
3. AI 或客服提示离线时，确认网络与后端服务可用，再使用页面提供的重试入口。
4. 数据看似消失时，确认网站地址、端口、浏览器、浏览器用户配置和设备是否与原来相同。
5. 导入失败时，只选择当前版本导出的完整 JSON 备份，不要使用手工拼接文件。
6. 操作仍失败时，保留错误提示和复现步骤，联系项目作者。

## 预期结果

- 能将问题定位为页面加载、本地存储、浏览器权限、网络或后端服务中的一类，并采用对应处理方式。

## 失败处理

- 未导出备份前，不要把“清空全部数据”当作常规排障步骤。
- 不要把 API Key、完整私人任务数据或浏览器敏感信息发送给客服。
- 当前文档没有覆盖的新版本行为，应回答“当前资料中无法确认”，并建议核对版本说明或联系维护者。

