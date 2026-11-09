import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("标题层级从 h2 起，三级及以下统一为 h4", () => {
    expect(renderMarkdown("# A\n\n## B\n\n### C\n\n#### D")).toBe("<h2>A</h2>\n<h3>B</h3>\n<h4>C</h4>\n<h4>D</h4>");
  });

  it("相邻文本行合并为一个段落，空行分段", () => {
    expect(renderMarkdown("a\nb\n\nc")).toBe("<p>a b</p>\n<p>c</p>");
  });

  it("无序列表、引用、粗体与行内代码", () => {
    const html = renderMarkdown("- **粗** 与 `code`\n- 第二项\n\n> 引用文字");
    expect(html).toContain("<ul><li><strong>粗</strong> 与 <code>code</code></li><li>第二项</li></ul>");
    expect(html).toContain("<blockquote>引用文字</blockquote>");
  });

  it("表格渲染表头与数据行，单元格内支持行内格式", () => {
    const html = renderMarkdown("| 权限 | 用途 |\n| --- | --- |\n| `storage` | 保存设置。 |");
    expect(html).toContain("<th>权限</th><th>用途</th>");
    expect(html).toContain("<td><code>storage</code></td><td>保存设置。</td>");
  });

  it("链接与 <url> 自动链接带 noopener，只放行 http(s) 与 mailto", () => {
    const html = renderMarkdown(
      "[站点](https://example.com/a?x=1&y=2) [邮件](mailto:a@b.dev) <https://example.com/b> [坏](javascript:alert(1))",
    );
    expect(html).toContain('<a href="https://example.com/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">站点</a>');
    expect(html).toContain('<a href="mailto:a@b.dev" target="_blank" rel="noopener noreferrer">邮件</a>');
    expect(html).toContain('<a href="https://example.com/b" target="_blank" rel="noopener noreferrer">https://example.com/b</a>');
    expect(html).not.toContain('href="javascript:');
  });

  it("转义 HTML，不会执行内嵌标签或属性", () => {
    const html = renderMarkdown('<script>alert(1)</script> [x" onmouseover="y](https://e.com) `<b>`');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<code>&lt;b&gt;</code>");
    expect(html).not.toMatch(/<a [^>]*onmouseover/);
  });
});
