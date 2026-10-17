# HMAIGC 弘梦

让 Agent 在授权的弘梦画布中整理内容、查询模型和报价，并按当前授权策略生成图片或视频。

> `0.1.0-rc.2` 是适配账号级一次授权的插件分发候选版，需要支持 Schema 60 授权策略的 HMAIGC 服务。云端 Remote MCP / OAuth 尚待部署与验收；安装包可用于安装验证，不代表现在能完成线上登录和生成。仓库发布不会更新云端服务。

此候选同步下述一次性账号授权说明；旧固定标签 `v0.1.0-rc.1` 保持原内容，不包含新策略说明。安装和使用须核对服务实际返回的授权策略，不因更新插件自动扩权。

长期 MCP 地址：`https://hm.kunagent.com/mcp`。两个业务域名共用此连接地址。

## 安装到 Codex

在支持 Plugin Marketplace 的 Codex CLI 中执行：

```sh
codex plugin marketplace add https://github.com/ericqiandu/hmaigc-mcp.git --ref v0.1.0-rc.2
codex plugin add hmaigc@hmaigc
```

若客户端需要重新加载，请重启客户端或开启新对话。服务部署并验收后，通过宿主的浏览器 OAuth 流程连接弘梦账号，核对账号、请求权限、账号全部画布范围和消费提醒，点击一次允许或拒绝，无需逐项勾选。插件不需要本地 CLI 二进制或 API Key，客户端根据 OAuth 元数据完成动态客户端注册（DCR）与 PKCE。

可直接发给 Agent：

```text
帮我配置 HMAIGC 弘梦插件，让 Agent 可以在我授权的画布里创作图片和视频。
1. 添加插件源：codex plugin marketplace add https://github.com/ericqiandu/hmaigc-mcp.git --ref v0.1.0-rc.2
2. 安装插件：codex plugin add hmaigc@hmaigc
3. 云端服务就绪后，引导我在浏览器连接弘梦账号，核对请求权限、账号全部画布范围与积分消费提醒，完成一次授权。
先告诉我安装和连接的实际结果及当前授权策略。仅在收到我的明确创作指令后生成：新账号级授权具备生成权限时可直接消费积分，旧连接仍按返回链接等待网页审批。
网络超时先按原 requestKey 查询，不换键重发；失败后增加付费重试需重新确认。
```

## 使用边界

以 `hmaigc_identity_get` 返回的 `authorizationPolicy`、scopes 和实际工具目录为准：

- `account_once_v2`：可按权限访问账号全部现有及新建画布，`canvasIds: []` 不代表无权访问。具备 `generation:create` 及服务端要求的权限和能力时，明确的创作指令可直接创建任务并预留积分，不再逐次网页审批；授权本身不会自动发起生成。
- `canvas_scoped_v1`：旧连接仅能访问原绑定画布，生成仍需用户通过返回的 `approvalUrl` 在弘梦网页逐次批准。旧连接不自动扩权，采用新策略须本人重新授权。
- 缺失或未知策略：不猜测账号范围或付费资格，不发起生成；先报告兼容性问题并核对服务或重新连接。

图片和视频生成读取画布节点已保存的规格。模型与报价来自服务端，估算不是最终账单；生成前告知模型、规格和预计积分。失败不授权额外付费重试；结果不明时查询原请求，不创建替代请求重复消费。连接有效期以服务端为准，当前为 30 天，可随时在网站“插件”页撤销；余额、配额、归属和防重复扣费校验仍然生效。

Remote MCP 不读取本地目录或上传本机文件；需要图片素材时先在网站上传。当前不提供文本、音频或批量生成，也不因账号授权自主发起消费。账号授权不包括后台管理、渠道密钥、支付配置或未来新增权限。仓库仅包含插件配置、Skill 和品牌资源，不分发网站后端或凭据。

## 开发与验证

Node.js 22 或更新版本，无需安装依赖：

```sh
node --test test/*.test.mjs
node scripts/validate-package.mjs
```

验证器检查发布文件清单、JSON、版本、路径边界、图标、固定 HTTPS MCP / OAuth resource，以及常见凭据。它不能代替云端 OAuth、真实 Agent 工具调用和付费任务验收。

已发布候选版曾通过 15 项包测试，以及 Windows Codex CLI `0.144.3` 独立配置中的本地源添加、插件安装、MCP 配置读取和 Skill 发现。本次只读复查中，两个 OAuth 发现端点仍返回 HTTP 200 `text/html`，不是 JSON；此前客户端报告 `auth_status=unsupported`。本次未重新运行真实 Codex 授权；云端登录、工具调用和生成仍待服务部署后验收。

打包规则参考 [OpenAI Plugin 文档](https://developers.openai.com/plugins/build/plugins)。本仓库采用受支持的 Codex 兼容布局：`.agents/plugins/marketplace.json`、`plugins/hmaigc/.codex-plugin/plugin.json` 与 `.mcp.json`。
