import { describe, expect, it } from "vitest";
import type {
  ForceReplaceRule,
  UserDictionary,
  VariantCode,
} from "../../shared/types";
import { normalizeSettings } from "./index";

describe("normalizeSettings - 纵深防御", () => {
  it("丢弃 allowTerms 中的非字符串 / 空白项并去重", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: {
          "zh-CN": [" foo ", "foo", 123, "", " bar ", null, "foo"] as unknown as string[],
          "zh-TW": [],
          "zh-HK": [],
          "zh-Hant": [],
        },
        forceReplaceRules: [],
      },
    });
    expect(settings.userDictionary.allowTerms["zh-CN"]).toEqual(["foo", "bar"]);
  });

  it("allowTerms 为非数组时被忽略而非抛错", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": "not-an-array" } as unknown as UserDictionary["allowTerms"],
        forceReplaceRules: [],
      },
    });
    expect(settings.userDictionary.allowTerms["zh-CN"]).toEqual([]);
  });

  it("forceReplaceRules 仅保留 from 非空且类型正确的条目", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        forceReplaceRules: [
          { id: "1", variant: "zh-TW", from: " 你好 ", to: " 妳好 ", enabled: true },
          { id: "2", variant: "zh-CN", from: "", to: "x", enabled: true },
          { from: 123, to: 456 } as unknown as ForceReplaceRule,
          "garbage" as unknown as ForceReplaceRule,
        ],
      },
    });
    expect(settings.userDictionary.forceReplaceRules).toHaveLength(1);
    const kept = settings.userDictionary.forceReplaceRules[0];
    expect(kept.from).toBe("你好");
    expect(kept.to).toBe("妳好");
    expect(kept.variant).toBe("zh-TW");
  });

  it("forceReplaceRules 非法 variant 回退到默认 zh-TW", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        forceReplaceRules: [
          { id: "1", variant: "xx" as unknown as VariantCode, from: "a", to: "b", enabled: true },
        ],
      },
    });
    expect(settings.userDictionary.forceReplaceRules[0].variant).toBe("zh-TW");
  });

  it("未提供 userDictionary 时返回空字典", () => {
    const settings = normalizeSettings({});
    expect(settings.userDictionary.allowTerms["zh-CN"]).toEqual([]);
    expect(settings.userDictionary.forceReplaceRules).toEqual([]);
  });
});
