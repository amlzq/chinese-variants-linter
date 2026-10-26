# 隐私政策 / Privacy Policy

适用于浏览器扩展 Chinese Variants Linter（以下简称「本扩展」）。

## 中文

**本扩展不收集、不传输、不出售任何用户数据。**

- **本地处理**：本扩展读取网页编辑区（`textarea`、文本 `input`、`contenteditable`）中的文本以及你选中的文本，仅用于在本机检查中文简繁字形与地区用词。文本不会离开你的设备，也不会被保存。
- **本地存储**：目标地区用语、检测强度、站点开关、允许词、强制替换规则和快捷键等设置保存在浏览器的扩展本地存储（`storage.local`）中，不会同步到任何服务器。卸载扩展即会删除这些数据。
- **无网络请求**：本扩展不包含统计、遥测、广告或任何第三方服务，运行时不发起网络请求。简繁转换字典（OpenCC）随扩展一起打包。
- **反馈链接**：只有当你主动点击「反馈」时，才会在新标签页打开本项目的 GitHub Issues 页面；该页面受 GitHub 隐私政策约束。

### 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 在本地保存你的设置与词库。 |
| `activeTab` | 打开扩展弹窗时读取当前标签页的地址，以显示该站点的启停开关。 |
| 在所有网站运行内容脚本 | 用户可在任意网站开启检查（或开启「全站点默认开启检查」），因此内容脚本需要能在这些页面上运行。站点检查默认关闭，未开启的站点不会检查任何文本。 |

## English

**This extension does not collect, transmit, or sell any user data.**

- **Local processing**: The extension reads text in editable fields (`textarea`, text `input`, `contenteditable`) and text you select, solely to check Chinese script and regional wording on your device. The text never leaves your device and is not stored.
- **Local storage**: Settings such as target variant, detection level, per-site toggles, allowed terms, forced replacement rules, and shortcuts are kept in the browser's extension local storage (`storage.local`) and are never synced to any server. Uninstalling the extension removes them.
- **No network requests**: The extension contains no analytics, telemetry, ads, or third-party services, and makes no network requests at runtime. The conversion dictionary (OpenCC) ships with the extension.
- **Feedback link**: Only when you click "Feedback" does the extension open this project's GitHub Issues page in a new tab; that page is subject to GitHub's privacy policy.

### Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Save your settings and dictionaries locally. |
| `activeTab` | Read the current tab's address when you open the popup, to show that site's toggle. |
| Content script on all sites | You can turn checking on for any site (or enable it for all sites by default), so the content script must be able to run on those pages. Checking is off by default; no text is checked on sites you have not enabled. |

## 联系 / Contact

<https://github.com/amlzq/chinese-variants-linter/issues>
