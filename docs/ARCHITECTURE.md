# 架构说明

## 设计目标

- **本地优先**：所有检测在浏览器内完成，不产生网络请求
- **最小权限**：仅使用 `storage` 与 `tabs`，不申请额外能力
- **双浏览器兼容**：Chrome MV3 与 Firefox MV3（109+）共用同一套源码
- **可审计构建**：copy-only 构建，不压缩、不混淆、不打包，产物可直接比对源码

## 源码布局

| 路径                           | 职责                                                |
| ------------------------------ | --------------------------------------------------- |
| `src/core/defaults.js`         | 默认规则 / 站点、`normalizeText()`、`scanText()`    |
| `src/background/background.js` | 首次安装初始化、`sync` → `local` 迁移、配置变更广播 |
| `src/content/`                 | 内容脚本、站点适配、输入监听、拦截、高亮与警告条    |
| `src/ui/lang.template.js`      | i18n 运行时逻辑，构建时注入文案                     |
| `src/ui/options.*`             | 配置页：规则、测试面板、站点                        |
| `src/ui/popup.*`               | 工具栏弹窗                                          |
| `manifests/base.json`          | 共享清单字段                                        |
| `manifests/chrome.json`        | Chrome 差异：`background.service_worker`            |
| `manifests/firefox.json`       | Firefox 差异：`background.scripts` 与 gecko 配置    |
| `scripts/`                     | 文案生成、清单生成、构建                            |
| `_locales/`                    | 文案唯一源（`en` / `zh_CN`）                        |
| `tests/`                       | 单元测试与构建测试                                  |

构建产物写入 `dist/chrome` 与 `dist/firefox`，并保持扩展根目录扁平结构，清单中的路径与运行时相对引用不需要改写。

## 构建流水线

```text
_locales/{en,zh_CN}/messages.json
  → scripts/gen-i18n.mjs
  → src/generated/lang.js
  → dist/<target>/lang.js

manifests/base.json + manifests/<target>.json + package.json.version
  → scripts/gen-manifests.mjs
  → dist/<target>/manifest.json

src/**、_locales/、icons/、privacy.html、LICENSE
  → scripts/build.mjs（复制）
  → dist/chrome/、dist/firefox/
```

生成物 `src/generated/lang.js` 与整个 `dist/` 不提交。版本号只在 `package.json` 维护，构建时注入清单；测试会校验生成结果。

## 运行时组成

内容脚本按以下顺序注入：`defaults.js` → `lang.js` → `content-script.js`，运行时机为 `document_idle`，匹配 `<all_urls>`。脚本之间通过全局变量协作，`defaults.js` 把 API 挂到 `window.__AI_GUARD_DEFAULTS__`。

配置页与弹窗同样加载 `defaults.js` 与生成的 `lang.js`，因此三处共用同一份默认值与文案。

## 数据流

```text
首次安装
  background.onInstalled
    ├─ local.settings 已存在 → 不处理
    ├─ sync.settings 存在   → 迁移到 local
    └─ 否则                 → 写入默认配置

用户修改配置（options / popup）
  → chrome.storage.local.set({ settings })
      → background.storage.onChanged
          → tabs.sendMessage({ type: 'AI_GUARD_CONFIG_CHANGED' })
              → content script 重新读取 settings 并重建适配器

用户输入 / 粘贴
  → 读取输入框文本
      → normalizeText()（去零宽、全角转半角）
          → 逐条规则匹配（keyword / regex）
              → hits[{ rule, match, index }]
                  → 高亮 + 警告条 + 按 severity 决定是否拦截
```

发送拦截有两条路径：

1. 捕获 `keydown` 的 Enter（不含 Shift / Ctrl / Meta），命中 `error` 规则时 `preventDefault`
2. 命中后禁用发送按钮，并拦截按钮点击

配置以 `chrome.storage.local` 为唯一持久化位置；语言选择使用独立键 `ai_guard_lang`。

## 扫描与抗变形

`scanText(text, rules)` 是纯函数：

- 先对全文做归一化：移除 U+200B–U+200F、U+FEFF、U+2060、U+00AD，全角字符转半角，U+3000 转空格
- 建立「归一化位置 ↔ 原始位置」映射，保证返回的 `match` 与 `index` 对应原始文本
- 关键字匹配大小写不敏感；正则使用 `g` 标志逐次执行
- 单条规则异常（如非法正则）会被跳过，不影响其他规则

## i18n

- `_locales/{en,zh_CN}/messages.json` 是唯一文案源
- `extName` / `extDesc` 仅供浏览器清单使用，不注入运行时
- `scripts/gen-i18n.mjs` 将文案注入 `src/ui/lang.template.js` 的占位符，生成 `src/generated/lang.js`，并用 Prettier 统一格式
- 运行时 `L.init()` 读取 `chrome.storage.local` 的语言偏好，回退到浏览器语言
- 新增文案时只需修改两个 `_locales` 文件并重新构建

## 站点适配

`content-script.js` 内置 7 个适配器：ChatGPT、Claude、Copilot、Gemini、豆包、元宝、Kimi。每个适配器提供输入框与发送按钮选择器，失败时回退到通用选择器。用户可在配置页添加自定义站点（`host` 支持 `*.example.com`）。

## 已知技术债

以下问题已在规划中，修复前请勿在文档或 PR 中声称已解决：

- `lang.js` 的 `data-i18n-html` 分支使用 `textContent`，含标签的文案会显示字面量
- 语言检测仅接受 `en` / `zh_CN`，`zh-CN`、`zh-TW` 等会被降级为英文
- `background.js` 复制了一份默认规则，与 `src/core/defaults.js` 存在分叉风险
- 配置更新存在多条通道，可能重复处理
- 内容脚本每 1.5s 轮询检查输入框，开销偏高
- 每次扫描重新编译正则，长文本下成本较高
- Enter 拦截未检查 `isComposing`，中文输入法选词回车可能被误拦截
- 部分发送按钮为 SVG 时，`className` 不是字符串，现有判断可能抛错
- 配置页每次按键即保存并弹出提示，写入与提示过于频繁
- 导入 JSON 缺少结构校验
- Firefox 中 `chrome.*.sendMessage()` 可能返回 `undefined`，现有 `.catch()` 写法不兼容

后续修复计划见 [ROADMAP.md](ROADMAP.md)。

## 安全模型

- 无 `fetch` / `XMLHttpRequest` / WebSocket / 遥测
- 无远程脚本、远程配置或远程规则更新
- 不使用 `eval` / `new Function`
- 配置与语言偏好仅存于本地
- 权限仅 `storage` 与 `tabs`；新增权限需在 PR 与商店说明中论证

详细测试与发布流程见 [TESTING.md](TESTING.md) 与 [RELEASE.md](RELEASE.md)。
