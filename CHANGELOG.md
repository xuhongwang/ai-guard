# Changelog

本文件记录 AI Guard 的重要变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- 点击拦截优先使用站点配置 / 内置适配器的发送按钮，自定义站点的「发送按钮选择器」真正生效
- 新增智谱清言（`chatglm.cn`）内置适配器，修复点击发送按钮无法拦截的问题

### Added

- ESLint、Prettier、EditorConfig 与 Node 版本约束
- 单元测试：清单一致性、i18n 键与占位符、归一化与规则扫描
- GitHub Actions CI 与 Dependabot
- 开发、架构、测试、发布、安全与路线图文档
- Issue / Pull Request 模板
- copy-only 构建：`src/` + `manifests/` → `dist/chrome`、`dist/firefox`
- `_locales` → `src/generated/lang.js` 文案生成
- 清单生成与 `package.json` 单一版本来源
- 导入配置结构校验：字段类型、规则类型、正则与站点
- 删除规则 / 站点后可在提示中撤销，条目回到原位置
- jsdom 配置页测试：渲染、开关持久化、删除撤销、非法导入与保存防抖

### Changed

- `gitignore` 重命名为 `.gitignore`，补充构建与测试产物
- 统一换行为 LF，新增 `.gitattributes`
- 使用 Prettier 格式化现有源码
- `README` 重构，补充 English summary 与开发入口
- 扩展开发改为先构建，再加载 `dist/chrome` / `dist/firefox`
- 删除 `defaults.js` 中重复的 i18n 表，文案只维护 `_locales`
- 清理 `_locales` 中未使用的规则描述键，并同步运行时文案
- `background.js` 与内容脚本复用 `defaults.js`，删除重复默认规则与扫描器
- 配置更新统一由 `storage.onChanged` 处理，移除广播与 `tabs` 权限
- 输入框变化改用 `MutationObserver` + `focusin` + 路由事件，移除 1.5s 轮询
- 正则按 pattern 缓存，避免每次扫描重新编译
- 配置页文本输入保存防抖 350ms，并合并重复的保存提示

### Fixed

- SPA 站内跳转后旧警告条不消失
- 警告条悬停时无法在顶部 / 底部之间切换
- `npm test` 在 Node 22 下无法定位测试目录
- `data-i18n-html` 文案显示标签字面量
- `zh-CN`、`zh-TW` 等语言未映射到中文界面
- 中文输入法选词回车被误拦截
- SVG 发送按钮的 `className` 判断抛错

## [1.0.0] - 2026-09-04

### Added

- 关键字 / 正则敏感内容检测，支持 `warn` / `error` 级别
- 输入高亮、警告条、Enter 与发送按钮拦截
- 抗变形检测：零宽字符去除、全角转半角
- 内置 ChatGPT / Claude / Copilot / Gemini / 豆包 / 元宝 / Kimi 适配器
- 自定义站点、规则增删改、导入导出、恢复默认
- 规则测试面板
- 中英文界面与本地语言偏好
- 完全本地运行，无网络请求与遥测
