# HMAIGC 弘梦

让 Agent 在授权的弘梦画布中整理内容、查询模型和报价，并申请图片或视频生成。

> `0.1.0-rc.1` 是插件分发候选版。云端 Remote MCP / OAuth 尚待部署与验收；安装包可用于安装验证，不代表现在能完成线上登录和生成。仓库发布不会更新云端服务。

长期 MCP 地址：`https://hm.kunagent.com/mcp`。两个业务域名共用此连接地址。

## 安装到 Codex

在支持 Plugin Marketplace 的 Codex CLI 中执行：

```sh
codex plugin marketplace add https://github.com/ericqiandu/hmaigc-mcp.git --ref v0.1.0-rc.1
codex plugin add hmaigc@hmaigc
```

若客户端需要重新加载，请重启客户端或开启新对话。服务部署并验收后，通过宿主的浏览器 OAuth 流程连接弘梦账号，选择权限和画布。插件不需要本地 CLI 二进制或 API Key，客户端根据 OAuth 元数据完成动态客户端注册（DCR）与 PKCE。

可直接发给 Agent：

```text
帮我配置 HMAIGC 弘梦插件，让 Agent 可以在我授权的画布里创作图片和视频。
1. 添加插件源：codex plugin marketplace add https://github.com/ericqiandu/hmaigc-mcp.git --ref v0.1.0-rc.1
2. 安装插件：codex plugin add hmaigc@hmaigc
3. 云端服务就绪后，引导我在浏览器连接弘梦账号，核对权限并选择画布。
先告诉我安装和连接的实际结果。每次付费生成都先给我网页审批链接，等我批准。
```

## 使用边界

插件只操作用户明确授权的画布。图片和视频生成先读取画布节点的已保存规格，每次都需要用户在弘梦网页单独批准；连接授权不会自动扣积分。模型与报价来自服务端，估算不是最终账单。网络超时后查询原请求，不创建替代请求重复消费。

Remote MCP 不读取本地目录或上传本机文件；需要图片素材时先在网站上传。当前不提供文本、音频、批量生成或自动消费。仓库仅包含插件配置、Skill 和品牌资源，不分发网站后端或凭据。

## 开发与验证

Node.js 22 或更新版本，无需安装依赖：

```sh
node --test test/*.test.mjs
node scripts/validate-package.mjs
```

验证器检查发布文件清单、JSON、版本、路径边界、图标、固定 HTTPS MCP / OAuth resource，以及常见凭据。它不能代替云端 OAuth、真实 Agent 工具调用和付费任务验收。

候选版已通过 15 项包测试，以及 Windows Codex CLI `0.144.3` 独立配置中的本地源添加、插件安装、MCP 配置读取和 Skill 发现。当前云端两个 OAuth 发现端点返回网站 HTML，客户端报告 `auth_status=unsupported`；真实云端登录、工具调用和生成仍待服务部署后验收。

打包规则参考 [OpenAI Plugin 文档](https://developers.openai.com/plugins/build/plugins)。本仓库采用受支持的 Codex 兼容布局：`.agents/plugins/marketplace.json`、`plugins/hmaigc/.codex-plugin/plugin.json` 与 `.mcp.json`。
