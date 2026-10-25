/**
 * 统一品牌图标资源。
 *
 * 唯一的图标来源是 `src/assets/brand-icon.svg`（双字形卡片与校对勾）：
 * - 工具栏图标：由 `scripts/gen-icons.mjs` 读同一份 SVG 生成 PNG，写入 manifest 的 `icons`。
 * - 页内视图（复查面板 logo、浮动启动器状态图标）：以 `?raw` 内联进内容脚本并转为
 *   data URL，因此 manifest 无需声明 `web_accessible_resources`，网页无法通过
 *   扩展 URL 探测扩展是否安装。改一处 SVG 即全局生效。
 */
import brandIconSvg from "../assets/brand-icon.svg?raw";

const BRAND_ICON_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(brandIconSvg)}`;

/** 内联的品牌图标源码，供需要直接嵌入 `<svg>` 元素的场景使用。 */
export const BRAND_ICON_SVG = brandIconSvg;

/**
 * 返回品牌图标的 data URL。
 * 内容脚本中可直接用作 `<img src>` 或 CSS `url()`，与工具栏图标完全一致。
 */
export function getBrandIconUrl(): string {
  return BRAND_ICON_DATA_URL;
}
