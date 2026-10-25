一个浏览器扩展，用于在网页编辑区中检查中文简繁字形和地区用词是否与目标变体一致，并提供就地修改建议。

扩展在本地处理文本，适用于内容编辑、客服话术、表单填写和跨地区发布前的中文校对。

## 功能

- 支持简体中文、中文台湾、中文香港和繁体中文四种目标变体。
- 在 `textarea`、文本 `input` 与 `contenteditable` 编辑区中检测字形及地区用词差异。
- 输入停止 300ms 后自动检查；粘贴内容后立即检查。
- 以页面内标记、建议浮层和复查面板展示问题，并支持逐项替换、忽略一次和加入允许词。
- 支持选中文本后转换；在可编辑区域中可将转换结果直接写回。
- 可配置检测开关、检测强度、站点级启停、允许词、强制替换规则和快捷键。
- 用户设置与词库保存于浏览器本地存储。
- 提供英文、简体中文、中文（台湾）和中文（香港）界面。

## 安装与开发

本项目使用 [WXT](https://wxt.dev/) 和 React 开发，需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

开发服务启动后，在 Chromium 浏览器的扩展管理页开启开发者模式，加载控制台输出的开发目录。Firefox 可使用：

```bash
npm run dev:firefox
```

Firefox 构建要求 Firefox 140 或更高版本：manifest 中的 `data_collection_permissions`（声明不收集用户数据）自该版本起才被支持，更低版本无法通过安装校验。这一要求会排除部分旧版 Firefox 用户，属为满足当前发布规范的取舍。

## 构建

```bash
# Chrome、Edge 及其他 Chromium 浏览器
npm run build

# Firefox
npm run build:firefox
```

构建结果分别位于 `.output/chrome-mv3` 与 `.output/firefox-mv3`。如需生成分发压缩包：

```bash
npm run zip
npm run zip:firefox
```

## 使用说明

1. 打开扩展弹窗，选择目标中文变体和检测强度。
2. 「全站点默认开启检查」默认关闭；打开后所有站点默认生效。它下方的站点开关可针对当前站点单独覆盖该默认值。
3. 在已开启检查的网页编辑区输入、粘贴或选中文本。
4. 点击页面中的问题标记，选择替换、忽略，或将词语加入允许词。
5. 在弹窗中维护允许词、强制替换规则和快捷键。

## 测试与检查

```bash
# 单元测试
npm test

# TypeScript 类型检查
npm run compile
```

## 发版流程

版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)，变更记录维护在 [CHANGELOG.md](CHANGELOG.md)。

1. 更新 `package.json` 的 `version`，并在 `CHANGELOG.md` 中补充对应版本的变更条目。
2. 提交改动后打 tag 并推送：

   ```bash
   git commit -am "chore(release): v0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```

3. GitHub Actions 的 `Release` 工作流会自动校验 tag 与 `package.json` 版本一致，执行类型检查与单元测试，打包 Chrome 与 Firefox 产物，然后创建 GitHub Release 并附上三个压缩包：

   - `chinese-variants-linter-<version>-chrome.zip`：提交至 Chrome Web Store 与 Edge 加载项
   - `chinese-variants-linter-<version>-firefox.zip`：提交至 Firefox Add-ons
   - `chinese-variants-linter-<version>-sources.zip`：Firefox Add-ons 审核所需的源码包

   tag 与版本号不一致时工作流会直接失败，不会创建 Release。
4. 日常提交由 `CI` 工作流执行类型检查、单元测试与双目标构建验证；需要本地核对打包结果时，可手动运行 `npm run zip` 与 `npm run zip:firefox`，产物位于 `.output/`。

## 权限与隐私

扩展采用 Manifest V3，并只声明以下 API 权限：

- `storage`：保存检测偏好、站点开关和用户词库。
- `activeTab`：用户打开扩展弹窗时读取当前站点，以显示站点级开关。

内容脚本匹配网页地址，以便在网页编辑区执行核心检查功能。网页文本、词库和设置均在本地浏览器中处理；扩展不发送文本或用户数据到远程服务器。Firefox 构建包同时声明不收集或传输用户数据。

页内品牌图标以内联 data URL 注入，扩展未声明 `web_accessible_resources`，因此不会向任何网站暴露扩展资源，网页也无法通过扩展 URL 探测扩展是否安装。

## 商店数据声明

提交 Chrome Web Store 与 Firefox Add-ons 时，可直接复制以下文案填写表单。

### 中文

**单一用途**：在网页输入区域检测中文简繁字形与地区用词是否与用户选择的目标变体一致，并提供逐项替换建议。

**权限理由**：

- `storage`：保存检测开关、目标变体、站点列表、允许词与快捷键等本地设置。
- `activeTab`：用户打开扩展弹窗时读取当前标签页的主机名，用于显示该站点的启停开关。
- 内容脚本匹配 `<all_urls>`：扩展需在任意网站的表单、评论区与富文本编辑器中就地检查文本；仅在用户开启检查的站点执行检测，关闭时立即退出，不读取页面其他内容。
- 未申请 `tabs`、`history`、`cookies` 等权限，也未声明 `web_accessible_resources`。

**数据使用**：扩展不收集、不存储、不传输用户数据。页面文本仅在本地浏览器内存中处理，不会发送到任何服务器；用户设置保存在浏览器本地存储（`storage.local`），卸载扩展即被清除。Firefox 构建包在 `data_collection_permissions` 中声明 `none`。

### English

**Single purpose**: Detect Chinese script and regional wording in web input fields that do not match the variant selected by the user, and offer single-item replacement suggestions.

**Permission justification**:

- `storage`: persist local settings such as the enabled state, target variant, per-site switches, allow list and shortcuts.
- `activeTab`: read the active tab's hostname when the user opens the popup so the per-site switch can be displayed.
- Content scripts on `<all_urls>`: the extension checks text inside forms, comment boxes and rich-text editors on arbitrary sites. Detection only runs on sites the user has enabled and exits immediately otherwise; no other page content is read.
- No `tabs`, `history`, `cookies` or `web_accessible_resources` are requested.

**Data usage**: The extension does not collect, store or transmit user data. Page text is processed in memory in the local browser and is never sent to a server. Settings are kept in `storage.local` and removed when the extension is uninstalled.

## 项目结构

```text
entrypoints/       扩展后台、内容脚本和弹窗入口
src/core/          检测、规则、替换与本地存储逻辑
src/content/       页面内状态、交互组件与样式
src/shared/        共享类型、国际化和工具函数
src/assets/        品牌图标源文件与检测规则数据
public/            工具栏图标位图与本地化资源
```

## 许可证

[MIT](LICENSE)
