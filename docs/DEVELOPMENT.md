# 开发指南

## 环境要求

- Node.js 20.19+（`.nvmrc` 为 `20`）
- npm 10+
- Chrome 或 Firefox（Manifest V3）

## 安装与构建

```bash
npm ci
npm run build
```

构建采用 copy-only 方式，不引入打包器：

```text
src/core/defaults.js              → dist/<target>/defaults.js
src/background/background.js      → dist/<target>/background.js
src/content/content-script.js     → dist/<target>/content-script.js
src/content/content-style.css     → dist/<target>/content-style.css
src/ui/*                          → dist/<target>/*
src/generated/lang.js             → dist/<target>/lang.js
_locales/、icons/、privacy.html、LICENSE → dist/<target>/
manifests/{base,<target>}.json    → dist/<target>/manifest.json
```

在受限或离线环境中，建议把 npm 缓存与用户配置放到工作区，避免写入用户目录：

```powershell
$env:npm_config_cache='D:\workspaces\Extension\.npm-cache'
$env:npm_config_userconfig='D:\workspaces\Extension\npmrc'
npm ci
```

## 常用命令

| 命令                    | 说明                                       |
| ----------------------- | ------------------------------------------ |
| `npm run lint`          | ESLint 检查                                |
| `npm run lint:fix`      | ESLint 自动修复                            |
| `npm run format`        | Prettier 格式化全部文件                    |
| `npm run format:check`  | 仅校验格式                                 |
| `npm test`              | Node 内置测试运行器执行 `tests/unit`       |
| `npm run gen:i18n`      | 由 `_locales` 生成 `src/generated/lang.js` |
| `npm run gen:manifests` | 生成清单到 `dist/<target>`                 |
| `npm run build`         | 构建 `dist/chrome` 与 `dist/firefox`       |
| `npm run verify`        | lint + format:check + test + build         |

> `src/generated/lang.js` 与 `dist/` 均为生成物，不要手改或提交。文案只改 `_locales/`，清单只改 `manifests/`。

## 在 Chrome 中加载

1. 运行 `npm run build`
2. 打开 `chrome://extensions/`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist/chrome`
4. 修改源码后：
   - 重新运行 `npm run build`
   - 在扩展卡片上点击刷新
   - 刷新目标网页（内容脚本只在页面加载时注入）
   - 配置页 / 弹窗关闭后重新打开

## 在 Firefox 中加载

1. 运行 `npm run build`
2. 打开 `about:debugging#/runtime/this-firefox`
3. 点击「临时载入附加组件」，选择 `dist/firefox/manifest.json`

Firefox 使用 `manifests/firefox.json` 生成自己的清单（包含 `browser_specific_settings` 与 `background.scripts`），无需手动覆盖文件。

## 调试

- **Service worker**：`chrome://extensions/` → AI Guard →「Service Worker」/「检查视图」
- **内容脚本**：在目标页面打开 DevTools Console，日志前缀为 `AI Guard`
- **配置页**：右键扩展图标 →「选项」，或直接访问 `chrome-extension://<id>/options.html`
- **存储**：在扩展的 Service Worker DevTools 中执行 `chrome.storage.local.get(console.log)` 查看配置
- **网络**：Network 面板应只有页面自身请求；扩展不应产生任何网络请求

## 常见问题

### 修改后页面没有变化

内容脚本只在页面加载时注入。修改源码后需要重新 `npm run build`、刷新扩展并刷新目标页面；仅修改 `background.js` 也需在扩展页刷新。

### 生成的 lang.js 与源文件不一致

不要直接编辑 `src/generated/lang.js`。修改 `_locales/{en,zh_CN}/messages.json` 后运行 `npm run gen:i18n`，或直接运行 `npm run build`。

### 配置更新如何生效

配置写入 `chrome.storage.local` 后，内容脚本通过 `storage.onChanged` 重新加载并重新扫描，不需要手动广播消息。

### 正则规则无效

规则在运行时编译。非法正则会静默跳过，不会中断扫描；可在配置页的测试面板验证。避免使用灾难性回溯的正则。

### 配置不同步

配置通过 `chrome.storage.local` 持久化，内容脚本监听 `storage.onChanged` 自动更新。若目标标签页是在扩展安装前打开的，刷新页面即可。

### CSP 报错

扩展页面禁止内联脚本、`eval` 与远程脚本。请使用外部 `.js` 文件并通过事件监听绑定行为。

## 目录导航

- `src/core/defaults.js`：默认规则、默认站点、`normalizeText`、`scanText`
- `src/core/settings.js`：导入配置校验、字段归一化与删除撤销恢复
- `src/content/content-script.js`：站点适配、输入监听、发送拦截、警告 UI
- `src/background/background.js`：首次安装初始化与旧配置迁移
- `src/ui/lang.template.js`：i18n 逻辑模板，构建时注入 `_locales` 文案
- `src/ui/options.*` / `src/ui/popup.*`：配置页与弹窗
- `manifests/`：共享清单与浏览器差异
- `scripts/`：i18n、清单与构建脚本
- `tests/unit/`：清单、构建、i18n、扫描逻辑测试
- `docs/`：架构、测试、发布文档
