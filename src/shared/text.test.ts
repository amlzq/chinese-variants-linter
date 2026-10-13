import { describe, expect, it } from "vitest";
import { containsCjk } from "./text";

describe("containsCjk", () => {
  it("中文文本返回 true", () => {
    expect(containsCjk("你好世界")).toBe(true);
  });

  it("扩展 A 区（BMP 内 \u3400-\u4dbf）汉字返回 true", () => {
    // 注意：BMP 外的扩展 A 字符以 UTF-16 代理对存储，无法被该正则命中，
    // 此行为与 selectionToolbar 共用同一份判断，保持一致。
    expect(containsCjk("㐀")).toBe(true);
  });

  it("纯英文文本返回 false", () => {
    expect(containsCjk("hello world")).toBe(false);
  });

  it("中英文混合文本返回 true", () => {
    expect(containsCjk("hello 你好")).toBe(true);
  });

  it("不含汉字的数字与符号返回 false", () => {
    expect(containsCjk("123 !@#")).toBe(false);
  });

  it("空串返回 false", () => {
    expect(containsCjk("")).toBe(false);
  });
});
