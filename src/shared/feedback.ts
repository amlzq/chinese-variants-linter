/**
 * 反馈入口。链接由后台脚本在新标签页打开：
 * 内容脚本运行在网页上下文中，`window.open` 会被页面弹窗拦截策略影响，
 * 也容易被 SPA 的全局路由劫持，因此统一交给后台处理。
 */
export const FEEDBACK_URL = "https://github.com/amlzq/chinese-variants-linter/issues";

export function openFeedbackPage(): Promise<unknown> {
  return browser.runtime.sendMessage({ type: "feedback/open" });
}
