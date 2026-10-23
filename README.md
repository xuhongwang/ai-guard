# AI Guard

[![CI](https://github.com/xuhongwang/ai-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/xuhongwang/ai-guard/actions/workflows/ci.yml)

在 AI 网页版输入框中实时检测敏感关键字与正则，命中后高亮、显示警告条，并按规则级别拦截发送。规则与站点均可自定义，检测全程在本地完成。

**English summary:** AI Guard is a Chrome/Firefox (MV3) extension that scans text typed into AI chat inputs for secrets and sensitive phrases, highlights matches, warns the user, and can block sending. Everything runs locally, with no telemetry and no network requests.

## 功能特性

- **实时检测**：输入、粘贴时即时扫描，命中片段高亮显示
- **分级处理**：`error` 级别拦截发送并警告，`warn` 级别仅提醒
- **抗变形**：自动去除零宽字符（U+200B–U+200F、U+FEFF 等），并将全角字符转为半角后匹配
- **内置站点适配**：ChatGPT、Claude、Microsoft Copilot、Gemini、豆包、元宝、Kimi，可一键关闭
- **自定义站点**：填写域名（支持 `*.example.com`）、输入框与发送按钮选择器即可接入任意站点
- **规则管理**：关键字 / 正则规则，支持增删改、启用开关、导入导出与恢复默认
- **规则测试面板**：粘贴样例文本，实时查看命中规则与高亮结果
- **多语言**：中文 / English，选择结果保存在本地
- **隐私优先**：无网络请求、无遥测、无远程代码，配置仅保存在浏览器本地

## 安装

### Chrome（开发者模式）

1. 打开 `chrome://extensions/`，开启右上角「开发者模式」
2. 点击「加载已解压的扩展程序」，选择本仓库根目录（包含 `manifest.json`）
3. 打开任意受支持的 AI 站点即可看到效果；点击工具栏图标可快速开关

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」，选择 `manifest.firefox.json`
3. 若当前 Firefox 要求文件名必须为 `manifest.json`，请先备份并替换后再加载（后续构建流程会消除此步骤）

> 商店版本可能滞后于仓库。开发、测试与问题复现请使用仓库版本。Chrome 与 Firefox 均要求 Manifest V3，Firefox 需 109+。

## 使用

- **总开关 / 子开关**：点击工具栏图标，控制检测、视觉警告与发送拦截
- **配置规则**：扩展管理页进入「扩展程序选项」，或右键工具栏图标选择「选项」
- **添加站点**：在配置页「站点配置」中填写域名与选择器，按 F12 可在目标页面审查元素
- **导出备份**：配置页支持导出 / 导入 JSON，便于多设备迁移

## 隐私

AI Guard 不会上传、记录或分析你的输入内容：

- 不包含任何网络请求、统计、埋点或远程配置
- 规则、站点与开关状态保存在 `chrome.storage.local`
- 详细说明见 [privacy.html](privacy.html)

## 开发

要求 Node.js **20.19+**（见 `.nvmrc`）。

```bash
npm ci
npm run verify   # lint + format:check + test
```

常用命令：

| 命令                   | 说明                            |
| ---------------------- | ------------------------------- |
| `npm run lint`         | ESLint 检查                     |
| `npm run format`       | Prettier 格式化                 |
| `npm run format:check` | 校验格式                        |
| `npm test`             | Node 内置测试运行器执行单元测试 |
| `npm run verify`       | 提交前完整校验                  |

开发、调试与浏览器加载说明见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)，架构说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，测试与发布清单见 [docs/TESTING.md](docs/TESTING.md) 与 [docs/RELEASE.md](docs/RELEASE.md)。

## 目录结构

```text
ai-guard/
├── manifest.json           # Chrome MV3 清单
├── manifest.chrome.json    # Chrome 清单副本（与 manifest.json 保持一致）
├── manifest.firefox.json   # Firefox MV3 清单
├── background.js           # Service worker：初始化、迁移与配置广播
├── content-script.js       # 注入网页：扫描、站点适配、拦截与警告 UI
├── content-style.css       # 警告条与高亮样式
├── defaults.js             # 默认规则 / 站点 / 归一化 / 扫描实现
├── lang.js                 # 运行时 i18n
├── _locales/               # 浏览器扩展文案（en / zh_CN）
├── options.html|css|js     # 配置页：规则、测试、站点
├── popup.html|js           # 工具栏弹窗
├── icons/                  # 图标
├── tests/                  # 单元测试
├── docs/                   # 开发、架构、测试、发布文档
└── .github/                # CI、Issue / PR 模板
```

## 说明与限制

- 仅作用于浏览器中的网页，无法管控桌面客户端（如 Cursor）
- 检测基于规则匹配，可能存在漏报或误报，不能替代完整的 DLP 方案
- 企业部署可自行打包 CRX，并通过 Chrome 策略强制安装，与出口 DLP 配合使用

## 参与贡献

欢迎提交 Issue 与 Pull Request。开始之前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)；安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

[MIT](LICENSE)
