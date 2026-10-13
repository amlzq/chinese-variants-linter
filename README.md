# 中文变体一致性检查浏览器扩展

基于 `WXT + React` 的 MVP 实现，支持在网页 `textarea`、普通文本 `input` 和基础 `contenteditable` 中检测中文变体不一致问题，并提供单项替换、忽略一次、加入允许词等操作。

## 已实现的 MVP 能力

- `popup` 中提供检测开关、目标变体、检测强度、站点启停、允许词、强制替换管理
- `content script` 识别常见可编辑区域并在输入、粘贴、聚焦后触发检测
- 内置字形规则和高置信度地区词汇规则
- 用户允许词与强制替换规则持久化到 `chrome.storage.local`
- 页面内对命中项绘制下划线，hover 时显示修改意见浮层，并支持单项替换

## 手动验证

推荐先启动扩展开发模式，再单独起一个静态服务访问本地验证页：

```bash
npm run dev
python3 -m http.server 4173
```

然后打开 [http://localhost:4173/docs/manual-validation.html](http://localhost:4173/docs/manual-validation.html)。

## 本地开发

```bash
npm install
npm run dev
```

## 类型检查

```bash
npm run compile
```

## 打包

构建生产版本（生成未压缩的扩展文件到 `.output` 目录）：

```bash
# Chrome / Chromium 系浏览器（默认）
npm run build

# Firefox
npm run build:firefox
```

构建并打包为可分发的 `zip` 文件（输出到 `.output` 目录）：

```bash
# Chrome / Chromium 系浏览器
npm run zip

# Firefox
npm run zip:firefox
```
