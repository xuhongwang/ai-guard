# 路线图

## Phase 0 — 仓库与紧急修复（已完成）

- [x] 仓库接入 `origin/main`，建立分支与 PR 流程
- [x] 修复 SPA 跳转后残留警告条
- [x] 警告条悬停切换顶部 / 底部

## Phase 1 — 工程基线（进行中）

- [x] ESLint / Prettier / EditorConfig / `.nvmrc`
- [x] 单元测试（清单、i18n、扫描逻辑）
- [x] GitHub Actions CI 与 Dependabot
- [x] README、贡献指南、架构 / 测试 / 发布文档、Issue / PR 模板
- [x] 迁移到 `src/` + `manifests/`
- [x] `_locales` 作为文案唯一源，生成 `lang.js`
- [x] copy-only 构建：`dist/chrome`、`dist/firefox`
- [x] 版本号单一来源（`package.json` → 清单）

## Phase 2 — P0 修复

### 2.1 i18n 正确性

- [x] `data-i18n-html` 使用 `innerHTML`，或移除该属性并统一为纯文本
- [x] 语言检测支持 `zh-CN`、`zh-TW`、`zh-Hans` 等，统一映射到 `zh_CN`
- [x] 删除重复的 `defaults.js` / `lang.js` 文案表，改为生成物

验收：中英文切换、带标签文案、浏览器语言首次安装均正确；文案键一致性测试通过。

### 2.2 配置单一来源与同步

- [x] 删除 `background.js` 中重复的默认规则，改为引用共享模块
- [x] 配置更新只保留一条主路径（`storage.onChanged`），移除重复广播
- [x] 导入配置增加结构校验（字段类型、规则类型、正则合法性）

验收：首次安装、旧配置迁移、导入非法 JSON、跨标签同步均有测试或手动用例。

### 2.3 Firefox 兼容

- [x] 所有 `chrome.*.sendMessage()` 调用先判断返回值或使用 `try/catch`（配置广播已移除）
- [ ] 在 Firefox 109+ 验证弹窗、配置页、内容脚本同步

验收：Firefox 控制台无 `undefined.catch` 类异常。

### 2.4 输入体验

- [x] Enter 拦截检查 `isComposing` 与 `keyCode === 229`
- [x] 发送按钮判断兼容 SVG（`className.baseVal` / `getAttribute('class')`）
- [x] 输入框变化从 1.5s 轮询改为 `MutationObserver` + `focusin` + 路由事件兜底
- [x] 正则按规则缓存，规则变更时失效

验收：中文输入法选词回车不误拦截；SPA 站点切换会话后检测仍生效；长文本扫描无明显卡顿。

### 2.5 配置页体验

- [x] 输入保存做 300–500ms 防抖
- [x] 成功提示节流，避免每次按键弹 toast
- [ ] 删除规则 / 站点提供撤销或二次确认

验收：连续编辑不产生大量写入与提示；误删可恢复。

## Phase 3 — 能力增强（待评估）

- 规则分组与按站点启用
- 更细的命中原因展示（规则名、位置）
- 可选的导出加密 / 团队配置模板
- 多语言扩展（日文、繁体等）
- 自动化浏览器测试（Playwright + 本地 fixture 页面）

## 非目标

- 远程规则更新、远程配置、账号体系
- 上传或分析用户输入
- 引入打包器、压缩或运行时依赖
- 自动发布商店
