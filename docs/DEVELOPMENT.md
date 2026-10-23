# 开发指南

## 环境要求

- Node.js 20.19+（`.nvmrc` 为 `20`）
- npm 10+
- Chrome 或 Firefox（Manifest V3）

## 安装依赖

```bash
npm ci
```

在受限或离线环境中，建议把 npm 缓存与用户配置放到工作区，避免写入用户目录：

```powershell
$env:npm_config_cache='D:\workspaces\Extension\.npm-cache'
$env:npm_config_userconfig='D:\workspaces\Extension\npmrc'
npm ci
```

## 常用命令

| 命令                   | 说明                                       |
| ---------------------- | ------------------------------------------ |
| `npm run lint`         | ESLint 检查                                |
| `npm run lint:fix`     | ESLint 自动修复                            |
| `npm run format`       | Prettier 格式化全部文件                    |
| `npm run format:check` | 仅校验格式                                 |
| `npm test`             | Node 内置测试运行器执行 `tests/unit`       |
| `npm run verify`       | lint + format:check + test，提交前必须通过 |

> 当前没有 `build` 脚本，扩展直接加载仓库源码。迁移 PR 会新增 copy-only 构建，输出到 `dist/`，仍不引入打包器。

## 在 Chrome 中加载

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择仓库根目录
4. 修改源码后：
   - 后台：在扩展卡片上点击刷新
   - 内容脚本：刷新目标网页
   - 配置页 / 弹窗：直接关闭再打开

## 在 Firefox 中加载

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择 `manifest.firefox.json`

如果当前 Firefox 版本要求文件名为 `manifest.json`，先备份现有文件再替换，验证后恢复：

```powershell
Copy-Item manifest.json manifest.chrome.backup.json
Copy-Item manifest.firefox.json manifest.json
# 验证完成后
Move-Item -Force manifest.chrome.backup.json manifest.json
```

> 迁移完成后，`npm run build` 会生成 `dist/firefox/manifest.json`，无需手动复制。

## 调试

- **Service worker**：`chrome://extensions/` → AI Guard →「Service Worker」/「检查视图」
- **内容脚本**：在目标页面打开 DevTools Console，日志前缀为 `AI Guard`
- **配置页**：右键扩展图标 →「选项」，或直接访问 `chrome-extension://<id>/options.html`
- **存储**：在扩展的 Service Worker DevTools 中执行 `chrome.storage.local.get(console.log)` 查看配置
- **网络**：Network 面板应只有页面自身请求；扩展不应产生任何网络请求

## 常见问题

### 修改后页面没有变化

内容脚本只在页面加载时注入。修改 `content-script.js`、`defaults.js`、`lang.js` 或样式后，需要刷新目标页面；修改 `background.js` 后需在扩展页刷新。

### Firefox 下消息发送报错

Firefox 中 `chrome.tabs.sendMessage()` / `chrome.runtime.sendMessage()` 可能返回 `undefined`，不能直接调用 `.catch()`。使用 `try/catch` 或先判断返回值。

### 正则规则无效

规则在运行时编译。非法正则会静默跳过，不会中断扫描；可在配置页的测试面板验证。避免使用灾难性回溯的正则。

### 配置不同步

配置通过 `chrome.storage.local` 持久化，并由 background 广播到已打开标签页。若目标标签页是在扩展安装前打开的，刷新页面即可。

### CSP 报错

扩展页面禁止内联脚本、`eval` 与远程脚本。请使用外部 `.js` 文件并通过事件监听绑定行为。

## 目录导航

- `defaults.js`：默认规则、默认站点、`normalizeText`、`scanText`
- `content-script.js`：站点适配、输入监听、发送拦截、警告 UI
- `background.js`：首次安装初始化、旧配置迁移、配置广播
- `lang.js`：运行时 i18n 与 DOM 渲染
- `options.*` / `popup.*`：配置页与弹窗
- `tests/unit/`：清单、i18n、扫描逻辑测试
- `docs/`：架构、测试、发布文档
