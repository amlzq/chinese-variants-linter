一个浏览器扩展，用于在网页编辑区中检查中文简繁字形和地区用词是否与目标变体一致，并提供就地修改建议。

扩展在本地处理文本，适用于内容编辑、客服话术、表单填写和跨地区发布前的中文校对。

## 功能

- 支持简体中文、中文（台湾）、中文（香港）和繁体中文四种目标变体。
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

构建结果分别位于 `.output/chrome-mv3` 与 `.output/firefox-mv3`。打包、发版与商店提交见 [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)。

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

## 权限与隐私

扩展采用 Manifest V3，只声明 `storage` 与 `activeTab` 权限。网页文本、词库和设置均在本地浏览器中处理，不会发送到任何服务器；未开启检查的站点不会插入任何页面节点。详见 [PRIVACY.md](PRIVACY.md)。

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
