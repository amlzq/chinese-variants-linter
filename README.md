**简体中文** | [English](README.en.md)

一个浏览器扩展，用于在网页编辑区中检查中文简繁字形和地区用词是否与目标地区用语一致，并提供就地修改建议。

扩展在本地处理文本，适用于内容编辑、客服话术、表单填写和跨地区发布前的中文校对。

## 功能

- 支持简体中文、中文（台湾）、中文（香港）和繁体中文四种目标地区用语。
- 在 `textarea`、文本 `input` 与 `contenteditable` 编辑区中检测字形及地区用词差异。
- 输入停止 300ms 后自动检查；粘贴内容后立即检查。
- 以页面内标记、建议浮层和复查面板展示问题，并支持逐项替换、忽略一次和加入允许词。
- 支持选中文本后转换；在可编辑区域中可将转换结果直接写回。
- 可配置检测开关、检测强度、站点级启停、允许词组、自定义词组和快捷键。
- 自定义词典按目标地区分开保存，支持编辑，以及 CSV / OpenCC 词条格式的导入、导出、模板下载和清空。
- 用户设置与词库保存于浏览器本地存储。

## 安装

- [Chrome 网上应用店](https://chromewebstore.google.com/detail/chinese-variants-linter/phnegnjebgcgjhdjedbpnejfplbfflbb)
- [Microsoft Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/chinese-variants-linter/nbdholbmndoilmlepmgmfnnmoimcfibg)
- [Firefox 附加组件](https://addons.mozilla.org/en-US/firefox/addon/chinese-variants-linter/)

## 使用说明

1. 打开扩展弹窗，选择目标中文地区用语和检测强度。
2. 「全站点默认开启检查」默认关闭；打开后所有站点默认生效。它下方的站点开关可针对当前站点单独覆盖该默认值。
3. 在已开启检查的网页编辑区输入、粘贴或选中文本。
4. 点击页面中的问题标记，选择替换、忽略，或将词语加入允许词。
5. 在弹窗中维护允许词组、自定义词组和快捷键。

## 服务条款与隐私权政策

- [服务条款](TERMS.md)
- [隐私权政策](PRIVACY.md)：扩展只声明 `storage` 与 `activeTab` 权限，网页文本、词库和设置均在本地处理，不会发送到任何服务器。

## 许可证

[MIT](LICENSE)
