# AI Guard — 敏感内容输入拦截（Chrome / Firefox 浏览器插件）

在 AI 网页版输入框中实时检测敏感关键字 / 正则，
命中即**禁用发送按钮 + 拦截 Enter + 高亮警告**。规则 & 站点均可自定义。支持抗变形检测（零宽字符去除 + 全角转半角）。

## 安装

### Chrome

1. 打开 `chrome://extensions/` → 右上角开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择本目录（含 `manifest.json`）
3. 点击工具栏图标或在扩展管理页点「扩展程序选项」进入配置页

### Firefox

1. 将 `manifest.firefox.json` 复制为 `manifest.json`（覆盖 Chrome 版）
2. 打开 `about:debugging` → 此 Firefox → 「加载临时附加组件」→ 选择 `manifest.json`
3. 测试完成后恢复 Chrome 版 `manifest.json`

## 功能特性

### 抗变形检测

自动处理常见绕过手段，确保规则匹配不被规避：
- **零宽字符去除**：过滤 U+200B-U+200F、U+FEFF 等不可见字符
- **全角转半角**：将 ａｂｃ 等全角字符转换为标准 ASCII 匹配

### 内置站点适配器

ChatGPT / Claude / Microsoft Copilot / Gemini / 豆包 / 元宝 / Kimi，支持一键开关。

## 配置页

### 📋 规则列表
- 增删改规则，类型支持 `关键字` / `正则`，级别支持 `拦截(error)` / `警告(warn)`
- 导出 / 导入 JSON，一键恢复默认

### 🧪 测试规则面板
- 输入样例文本，**实时高亮**命中的敏感片段，并按规则分组展示
- 同步显示 `拦截 / 警告` 计数
- 纯本地运行，改规则即时生效

### 🌐 站点配置
- 内置 9 个站点适配器（可一键开关）：ChatGPT、Claude、Copilot、Gemini、豆包、元宝、Kimi
- 自定义任意站点：`匹配域名`（支持 `*.子域` 通配）+ `输入框选择器` + `发送按钮选择器`
- 选择器可在目标网页按 F12 审查元素获取，留空走通用兜底

## 文件结构

```
ai-guard/
├── manifest.json          # Chrome MV3 清单
├── manifest.firefox.json  # Firefox MV3 清单
├── background.js          # 后台：首次安装写入默认配置 + 广播
├── content-script.js      # 注入网页：扫描引擎 + 站点适配器 + 拦截/高亮
├── content-style.css      # 警告样式
├── defaults.js            # 默认规则库 + 默认站点 + normalizeText() + scanText()
├── lang.js                # 多语言模块（i18n）
├── _locales/              # 翻译文件（en / zh_CN）
├── options.html/css/js    # 配置页：规则 / 测试 / 站点
├── popup.html/js          # 工具栏弹窗（总开关）
└── icons/
```

## 说明

- 仅作用于浏览器中的网页，无法管控桌面客户端（Cursor 等）
- 支持 Chrome（MV3）和 Firefox（MV3，需 109+）
- 企业部署可打包 CRX 并通过 Chrome 策略强制安装，配合出口 DLP 形成闭环
