import { describe, expect, it } from "vitest";
import type { VariantCode } from "../../shared/types";
import { convertTextToVariant, findScriptChanges, getScriptConverter } from "./script";

describe("convertTextToVariant", () => {
  it("覆盖完整字典，简繁双向转换", () => {
    expect(convertTextToVariant("这个网络设置没问题", "zh-TW")).toBe("這個網絡設置沒問題");
    expect(convertTextToVariant("這個網絡設置沒問題", "zh-CN")).toBe("这个网络设置没问题");
  });

  it("getScriptConverter 对同一变体复用实例", () => {
    expect(getScriptConverter("zh-TW")).toBe(getScriptConverter("zh-TW"));
  });

  it("一对多的字按上下文转换，不误转", () => {
    expect(convertTextToVariant("方面 面条 公里 里面 皇后 后来 头发 干净 干部", "zh-TW")).toBe(
      "方面 麵條 公里 裡面 皇后 後來 頭髮 乾淨 幹部",
    );
    expect(convertTextToVariant("方面 面条 里面 着急", "zh-HK")).toBe("方面 麪條 裏面 着急");
  });

  it("繁体输入中合法的简繁同形字保持不变", () => {
    expect(convertTextToVariant("干擾 里長 鄰里 若干 樹幹", "zh-TW")).toBe("干擾 里長 鄰里 若干 樹幹");
  });

  it("在繁体变体之间转换异体字", () => {
    expect(convertTextToVariant("裏面", "zh-TW")).toBe("裡面");
    expect(convertTextToVariant("裡面", "zh-HK")).toBe("裏面");
  });
});

describe("findScriptChanges", () => {
  const samples: Record<VariantCode, string> = {
    "zh-CN": "这个软件的网络设置没问题，方面、面条、皇后、后来、干扰、着急。",
    "zh-TW": "這個軟體的網路設定沒問題，方面、麵條、皇后、後來、干擾、著急，台灣。",
    "zh-HK": "這個軟件的網絡設定沒問題，方面、麪條、皇后、後來、干擾、着急。",
    "zh-Hant": "這個軟件的網絡設置沒問題，方面、麪條、皇后、後來、干擾、着急。",
  };

  for (const [variant, text] of Object.entries(samples) as Array<[VariantCode, string]>) {
    it(`符合 ${variant} 的文本不报告字形问题`, () => {
      expect(findScriptChanges(text, variant)).toEqual([]);
    });
  }

  it("逐字返回差异及其 UTF-16 区间", () => {
    expect(findScriptChanges("a网络b", "zh-TW")).toEqual([
      { start: 1, end: 2, source: "网", target: "網", contextSensitive: false },
      { start: 2, end: 3, source: "络", target: "絡", contextSensitive: false },
    ]);
  });

  it("不误报「方面」中的「面」", () => {
    const changes = findScriptChanges("方面", "zh-TW");
    expect(changes).toEqual([]);
  });

  it("依赖上下文的字标记为 contextSensitive", () => {
    const [change] = findScriptChanges("后来", "zh-TW");
    expect(change).toMatchObject({ source: "后", target: "後", contextSensitive: true });
  });

  it("台湾目标接受「台」，但「台风」仍提示「颱」", () => {
    expect(findScriptChanges("台北", "zh-TW")).toEqual([]);
    expect(findScriptChanges("台风", "zh-TW").map((change) => change.target)).toEqual(["颱", "風"]);
  });

  it("代理对字符前后的下标正确", () => {
    const changes = findScriptChanges("𠀀网", "zh-TW");
    expect(changes).toEqual([
      { start: 2, end: 3, source: "网", target: "網", contextSensitive: false },
    ]);
  });
});
