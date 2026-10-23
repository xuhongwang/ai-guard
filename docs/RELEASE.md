# 发布清单

本项目的 CI **不会**自动发布到商店。发布由维护者在本地完成，并保留可回溯的压缩包与提交记录。

## 1. 准备版本

- [ ] 确认 `main` 干净且 CI 通过
- [ ] 更新版本号：只改 `package.json`（构建时注入两个清单，测试会校验）
- [ ] 更新 `CHANGELOG.md`：把 `Unreleased` 改为 `vX.Y.Z - YYYY-MM-DD`
- [ ] 检查 `README.md`、`privacy.html` 与实际行为一致
- [ ] 提交：`chore(release): vX.Y.Z`

## 2. 完整校验

```bash
npm ci
npm run verify
```

- [ ] lint / format / 单元测试全部通过
- [ ] 按 [TESTING.md](TESTING.md) 完成 Chrome + Firefox 手动冒烟
- [ ] 用 DevTools Network 确认无扩展发起的网络请求
- [ ] 检查扩展页面与 Service Worker 无未捕获异常
- [ ] 确认未新增权限；如有，准备商店审核说明

## 3. 构建与打包

```bash
npm run build
```

构建会清空并重新生成 `dist/chrome` 与 `dist/firefox`，包含运行时文件、`_locales`、图标、`privacy.html`、`LICENSE` 以及对应清单。开发文件（`src/`、`tests/`、`docs/`、`scripts/`、`package*.json` 等）不会进入产物。

PowerShell 示例：

```powershell
$version = '1.1.0'
Compress-Archive -Path 'dist/chrome/*' -DestinationPath "dist/ai-guard-chrome-v$version.zip" -Force
Compress-Archive -Path 'dist/firefox/*' -DestinationPath "dist/ai-guard-firefox-v$version.zip" -Force
```

- [ ] 解压检查两个包内均有 `manifest.json`
- [ ] 清单版本号与 `package.json` 一致
- [ ] Chrome 包使用 `service_worker`；Firefox 包使用 `background.scripts` 且含 `browser_specific_settings`
- [ ] 包内不含测试数据、真实密钥或开发依赖

## 4. Chrome Web Store

- [ ] 开发者后台 → 上传 `ai-guard-chrome-vX.Y.Z.zip`
- [ ] 更新商店文案与截图（如界面有变化）
- [ ] 隐私实践：声明不收集用户数据
- [ ] 权限说明：`storage`（保存本地配置）、`tabs`（向已打开标签页广播配置变更）
- [ ] 版本说明填写本次变更
- [ ] 选择发布范围 / 分阶段发布
- [ ] 提交审核并记录提交时间

## 5. Firefox Add-ons (AMO)

- [ ] 上传 `ai-guard-firefox-vX.Y.Z.zip`
- [ ] 确认 `browser_specific_settings.gecko.id` 与已上架版本一致
- [ ] 数据收集声明选择「不收集」
- [ ] 更新版本说明与截图
- [ ] 提交审核

## 6. 发布后

- [ ] 打标签并推送：

  ```bash
  git tag -a vX.Y.Z -m "AI Guard vX.Y.Z"
  git push origin vX.Y.Z
  ```

- [ ] 创建 GitHub Release，附 CHANGELOG 摘要与两个 zip
- [ ] 从商店安装正式版本，完成一次基础冒烟
- [ ] 观察商店评论与 Issue，记录需要热修的问题

## 7. 回滚与热修

- 商店不支持撤回已发布的版本；如出现严重问题，立即发布补丁版本
- 保留上一次可用的 zip 与 tag，便于对比
- 若问题来自规则误报，可先发布仅调整规则的补丁版本
- 不得通过远程配置或远程规则热更新规避审核

## 8. 发布记录

每次发布记录：

- 版本号、日期、提交 SHA、tag
- Chrome / Firefox 审核状态与商店链接
- 已知问题与后续计划
