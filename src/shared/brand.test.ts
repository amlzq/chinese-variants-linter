import { describe, expect, it } from "vitest";
import { BRAND_ICON_SVG, getBrandIconUrl } from "./brand";

describe("getBrandIconUrl", () => {
  it("返回内联 SVG 的 data URL", () => {
    const url = getBrandIconUrl();

    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice(url.indexOf(",") + 1))).toBe(BRAND_ICON_SVG);
  });

  it("重复调用返回同一结果（模块级常量）", () => {
    expect(getBrandIconUrl()).toBe(getBrandIconUrl());
  });
});
