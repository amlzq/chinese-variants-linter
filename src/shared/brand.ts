/**
 * 统一品牌图标资源。
 *
 * 唯一的图标来源是 `public/icon.svg`（双字形卡片与校对勾）：
 * - 工具栏图标：由该 SVG 经构建 / 导出流程生成 PNG，写入 manifest 的 `icons`。
 * - 页内视图（复查面板 logo、浮动启动器状态图标）：通过 `browser.runtime.getURL`
 *   直接加载同一文件（需在 manifest 的 `web_accessible_resources` 中声明 `icon.svg`），
 *   改 `public/icon.svg` 一处即全局生效。
 */
export const BRAND_ICON_PATH = "/icon.svg";

let cachedBrandIconUrl: string | null = null;

/**
 * 返回品牌图标在扩展内的可访问 URL（web-accessible resource）。
 * 内容脚本中直接用该 URL 作为 `<img src>` 即可渲染与工具栏完全一致的图标。
 */
export function getBrandIconUrl(): string {
  if (cachedBrandIconUrl === null) {
    cachedBrandIconUrl = browser.runtime.getURL(BRAND_ICON_PATH);
  }
  return cachedBrandIconUrl;
}
