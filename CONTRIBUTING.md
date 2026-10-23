# 参与贡献

感谢你愿意改进 AI Guard。本项目优先保证**隐私、跨浏览器兼容与可审计性**，提交前请确认改动没有引入网络请求、遥测或额外权限。

## 开发环境

- Node.js 20.19+（推荐使用 `.nvmrc`）
- npm 10+
- Chrome 或 Firefox 用于手动验证

```bash
npm ci
npm run verify   # lint + format:check + test + build
npm run build    # 产物在 dist/chrome、dist/firefox
```

受限网络下可将 npm 缓存指向工作区：

```bash
npm_config_cache=../.npm-cache npm ci
```

## 分支与提交

- 从 `main` 创建分支：`feat/…`、`fix/…`、`chore/…`、`docs/…`、`refactor/…`
- 提交信息使用 Conventional Commits：`fix: clear stale warning bar on SPA navigation`
- 一个 PR 只解决一个问题；不要直接向 `main` 推送
- 不提交 `node_modules/`、`dist/`、缓存、日志或真实密钥

## 代码规范

- 运行 `npm run format`，保持 LF、2 空格、单引号、分号
- 扩展代码运行在浏览器中，禁止使用 Node API、`eval`、`new Function` 或远程脚本
- 保持 Chrome MV3 与 Firefox MV3 双兼容；注意 Firefox 中 `chrome.*.sendMessage()` 可能返回 `undefined`
- 不新增运行时依赖；新增开发依赖需在 PR 中说明必要性
- 新增权限需说明用途、隐私影响与商店审核理由

## 文案与 i18n

UI 文案不得硬编码。只修改：

1. `_locales/en/messages.json`
2. `_locales/zh_CN/messages.json`

然后运行 `npm run gen:i18n`。`src/generated/lang.js` 为生成物，不要手改或提交。

## 测试

- 纯逻辑改动：在 `tests/unit/` 补充测试，运行 `npm test`
- DOM、站点适配、发送拦截、i18n：按 [docs/TESTING.md](docs/TESTING.md) 手动冒烟
- 提交 PR 前运行 `npm run verify`
- 测试数据只能使用伪造密钥

## PR 检查清单

- [ ] 变更动机与行为变化已说明
- [ ] 已补充或更新测试
- [ ] `npm run verify` 通过
- [ ] 完成相关手动冒烟并记录浏览器 / 站点
- [ ] 未新增网络请求、遥测或远程代码
- [ ] 权限变更已说明（如有）
- [ ] 文案已同步中英文
- [ ] 已更新 `CHANGELOG.md` 的 `Unreleased`
- [ ] 已说明风险与回滚方式

## 报告问题

- 功能缺陷与建议：使用 GitHub Issue 模板
- 安全漏洞：**不要**公开提交 Issue，请按 [SECURITY.md](SECURITY.md) 私下报告
- Issue 中请勿粘贴真实密钥、完整对话或企业内网信息

## 行为准则

请保持尊重、就事论事。维护者有权关闭包含攻击性内容、泄露隐私或偏离项目目标的讨论。
