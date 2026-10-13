/**
 * DOM XSS 防护：集中维护转义函数，避免各处重复实现导致的遗漏。
 *
 * 所有注入到 innerHTML 或 HTML 属性中的用户可控字符串都必须先经过此函数。
 * 覆盖 & < > " ' 五种关键字符，既能保护标签上下文也能保护属性上下文。
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
