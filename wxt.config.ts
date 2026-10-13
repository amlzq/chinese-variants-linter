import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // manifest 级别多语言：name / description 由 _locales/<locale>/messages.json 提供，
    // 浏览器按界面语言自动选择，匹配不到时回退到 default_locale（en）。
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    permissions: ["storage", "tabs"],
    // 允许内容脚本把品牌图标（public/icon.svg）以 <img> 形式注入到网页中渲染，
    // 从而与工具栏图标共用同一份来源。
    web_accessible_resources: [
      {
        resources: ["icon.svg"],
        matches: ["<all_urls>"],
      },
    ],
  },
});
