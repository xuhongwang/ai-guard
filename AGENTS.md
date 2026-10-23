# AGENTS.md

本文件面向在此仓库工作的 AI 编码助手。开始修改前请先阅读 `README.md`、`docs/ARCHITECTURE.md` 与 `docs/TESTING.md`。

## 项目概览

AI Guard 是一个 Chrome / Firefox Manifest V3 扩展，在 AI 网页输入框中本地检测敏感关键字与正则，按 `warn` / `error` 级别提示或拦截发送。

- 纯前端扩展，**无网络请求、无遥测、无远程代码**
- 无打包器：`npm run build` 仅复制并生成文件到 `dist/chrome`、`dist/firefox`
- 源码在 `src/`，清单在 `manifests/`，文案源在 `_locales/`
- `src/generated/lang.js` 与 `dist/` 为生成物，**不要手改或提交**
- 多个脚本通过全局变量协作：`L`（i18n）、`DEFAULT_RULES` / `DEFAULT_SITES` / `DEFAULT_SETTINGS`、`normalizeText`、`scanText`，以及 `window.__AI_GUARD_DEFAULTS__`

## 环境与命令

- Node.js **20.19+**，npm 10+
- 安装：`npm ci`
- 校验：`npm run verify`（= lint + format:check + test + build）
- 单项：`npm run lint`、`npm run format`、`npm test`、`npm run build`
- 生成：`npm run gen:i18n`（文案）、`npm run gen:manifests`（清单）
- 构建为 copy-only，不引入打包器；产物在 `dist/`，不提交

在受限环境中可用工作区内的缓存与配置，避免写入用户目录：

```powershell
$env:npm_config_cache='D:\workspaces\Extension\.npm-cache'
$env:npm_config_userconfig='D:\workspaces\Extension\npmrc'
npm ci
```

## 代码约定

- 2 空格缩进、单引号、分号、LF；提交前运行 `npm run format`
- 扩展代码不得使用 Node API、`eval`、动态远程脚本或 `new Function`
- 保持 Chrome MV3 与 Firefox MV3 双兼容；配置更新统一使用 `storage.onChanged`，不要新增广播通道
- 新增跨脚本共享能力时，优先沿用 `window.__AI_GUARD_DEFAULTS__` 模式，并在 ESLint `globals` 中显式声明；不要制造新的隐式全局
- UI 文案不得硬编码：只修改 `_locales/en/messages.json` 与 `_locales/zh_CN/messages.json`，`lang.js` 由 `npm run gen:i18n` 生成，勿手改
- 不新增权限，除非 PR 中说明必要性、隐私影响与商店审核理由
- 不引入运行时依赖；开发依赖需说明用途，并优先使用 Node 内置能力

## 测试要求

- 纯逻辑改动必须补单元测试（`tests/unit/*.test.mjs`），优先覆盖边界、抗变形与非法输入
- 涉及 DOM、站点适配、发送拦截、i18n 渲染的改动，按 `docs/TESTING.md` 手动冒烟，并在 PR 中填写验证结果
- CI 必须通过；不得以跳过 lint / 测试的方式合并

## 提交与 PR

- 分支：`feat/…`、`fix/…`、`chore/…`、`docs/…`、`refactor/…`
- 提交信息：Conventional Commits，例如 `fix: clear stale warning bar on SPA navigation`
- 不在 `main` 直接提交；一个 PR 只做一件事
- PR 描述需包含：变更动机、行为变化、验证方式、风险与回滚方式
- 同步更新 `CHANGELOG.md` 的 `Unreleased`；行为或架构变化同步更新对应文档

## 安全与隐私红线

- 不上传、记录、打印用户输入或配置内容
- 不添加分析、崩溃上报、远程配置、远程规则更新
- 不在仓库、Issue、日志或测试夹具中放入真实密钥
- 发现安全问题时按 `SECURITY.md` 私下报告

## 不要提交

`node_modules/`、`dist/`、`src/generated/`、`tests/.tmp/`、`build/`、`coverage/`、测试报告、`.npm-cache/`、编辑器配置、真实凭据或 `.env` 文件。
