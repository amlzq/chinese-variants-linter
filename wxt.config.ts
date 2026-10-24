import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // WXT 默认将 Firefox 目标回退到 MV2；显式固定为 MV3，确保各发布包
  // 使用相同的权限和后台脚本模型。
  manifestVersion: 3,
  manifest: {
    // manifest 级别多语言：name / description 由 _locales/<locale>/messages.json 提供，
    // 浏览器按界面语言自动选择，匹配不到时回退到 default_locale（en）。
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    // `storage` 持久化用户的检查偏好；`activeTab` 仅在用户打开扩展
    // popup 时临时读取当前标签页地址，以显示该站点的启停开关。避免申请
    // `tabs`（可读取所有标签页信息）的常驻权限。
    permissions: ["storage", "activeTab"],
    // 允许内容脚本把品牌图标（public/icon.svg）以 <img> 形式注入到网页中渲染，
    // 从而与工具栏图标共用同一份来源。
    web_accessible_resources: [
      {
        resources: ["icon.svg"],
        matches: ["<all_urls>"],
      },
    ],
    // 扩展只在本地处理页面文本和本地设置，不会传输或在浏览器外处理用户数据。
    // Firefox 140+ 要求新扩展明确声明此事实。
    browser_specific_settings: {
      gecko: {
        // Firefox MV3 发布包必须具有稳定的扩展 ID；该 ID 与本项目的
        // GitHub 发布主体绑定，后续发布不可随意修改。
        id: "chinese-variants-linter@amlzq.github.io",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
