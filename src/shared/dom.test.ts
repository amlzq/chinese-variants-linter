import { describe, expect, it } from "vitest";
import { escapeHtml } from "./dom";

describe("escapeHtml", () => {
  it("转义关键 HTML 特殊字符", () => {
    expect(escapeHtml(`<script>"'&</script>`)).toBe(
      "&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;",
    );
  });

  it("保留普通文本", () => {
    expect(escapeHtml("你好 world")).toBe("你好 world");
  });

  it("阻止属性注入", () => {
    expect(escapeHtml(`"><img src=x onerror=alert(1)>`)).toBe(
      "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;",
    );
  });
});
