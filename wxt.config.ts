import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // WXT 默认将 Firefox 目标回退到 MV2；显式固定为 MV3，确保各发布包
  // 使用相同的权限和后台脚本模型。
  manifestVersion: 3,
  // 按目标浏览器生成 manifest：`browser_specific_settings` 只有 Firefox 认识，
  // 若一并写进 Chrome 包，Chrome 会提示“未知清单键”。这里只对 Firefox 输出。
  manifest: ({ browser }) => ({
    // manifest 级别多语言：name / description 由 _locales/<locale>/messages.json 提供，
    // 浏览器按界面语言自动选择，匹配不到时回退到 default_locale（en）。
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    // `storage` 持久化用户的检查偏好；`activeTab` 仅在用户打开扩展
    // popup 时临时读取当前标签页地址，以显示该站点的启停开关。避免申请
    // `tabs`（可读取所有标签页信息）的常驻权限。
    permissions: ["storage", "activeTab"],
    // 页内品牌图标由 src/assets/brand-icon.svg 内联为 data URL，
    // 因此不声明 web_accessible_resources：既不向所有站点暴露扩展资源，
    // 也让网页无法通过扩展 URL 探测扩展是否安装。
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              // Firefox MV3 发布包必须具有稳定的扩展 ID；该 ID 与本项目的
              // GitHub 发布主体绑定，后续发布不可随意修改。
              id: "chinese-variants-linter@amlzq.github.io",
              strict_min_version: "140.0",
              // 扩展只在本地处理页面文本和本地设置，不会传输或在浏览器外处理用户数据。
              // Firefox 140+ 要求新扩展明确声明此事实。
              data_collection_permissions: {
                required: ["none"],
              },
            },
          },
        }
      : {}),
  }),
});
