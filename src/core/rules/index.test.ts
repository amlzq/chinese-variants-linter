import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../storage";
import type { ScriptRule } from "../../shared/types";
import {
  convertTextToVariant,
  getScriptConverter,
  getScriptSuggestion,
  getSupportedVariants,
  loadRuleBundle,
} from "./index";

describe("rules", () => {
  it("getSupportedVariants 返回四个变体", () => {
    expect(getSupportedVariants().sort()).toEqual(["zh-CN", "zh-HK", "zh-Hant", "zh-TW"]);
  });

  it("getSupportedVariants 按界面展示顺序排列", () => {
    expect(getSupportedVariants()).toEqual(["zh-CN", "zh-TW", "zh-HK", "zh-Hant"]);
  });

  it("loadRuleBundle 返回非空的内置规则包", () => {
    const bundle = loadRuleBundle(DEFAULT_SETTINGS, "zh-TW");
    expect(Array.isArray(bundle.scriptRules)).toBe(true);
    expect(bundle.scriptRules.length).toBeGreaterThan(0);
    expect(Array.isArray(bundle.termRules)).toBe(true);
    expect(bundle.allowTerms instanceof Set).toBe(true);
  });

  it("loadRuleBundle 只保留目标变体有映射的规则", () => {
    for (const variant of getSupportedVariants()) {
      const bundle = loadRuleBundle(DEFAULT_SETTINGS, variant);
      for (const rule of bundle.scriptRules) {
        expect(rule.toByVariant[variant]).toBeDefined();
      }
      for (const rule of bundle.termRules) {
        expect(rule.targets[variant]).toBeDefined();
      }
    }
  });

  it("loadRuleBundle 合并启用中的用户强制替换规则，优先级最高", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      defaultVariant: "zh-TW",
      userDictionary: {
        forceReplaceRules: [
          { id: "on", variant: "zh-TW", from: "软件", to: "軟件", enabled: true },
          { id: "off", variant: "zh-TW", from: "视频", to: "影片", enabled: false },
          { id: "other", variant: "zh-CN", from: "軟體", to: "软件", enabled: true },
        ],
      },
    });

    const bundle = loadRuleBundle(settings, "zh-TW");
    const userRules = bundle.termRules.filter((rule) => rule.source === "user");
    expect(userRules.map((rule) => rule.id)).toEqual(["on"]);
    expect(userRules[0]?.priority).toBeGreaterThan(1000);
    expect(userRules[0]?.targets["zh-TW"]).toBe("軟件");
  });

  it("loadRuleBundle 的用户规则缺少 id 时生成回退 id", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      defaultVariant: "zh-TW",
      userDictionary: {
        forceReplaceRules: [{ id: "", variant: "zh-TW", from: "视频", to: "影片", enabled: true }],
      },
    });
    const bundle = loadRuleBundle(settings, "zh-TW");
    expect(bundle.termRules[0]?.id).toBe("fr-0");
  });

  it("loadRuleBundle 按目标变体收集允许词", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      userDictionary: { allowTerms: { "zh-TW": ["軟體"], "zh-HK": ["軟件"] } },
    });
    expect(loadRuleBundle(settings, "zh-TW").allowTerms.has("軟體")).toBe(true);
    expect(loadRuleBundle(settings, "zh-TW").allowTerms.has("軟件")).toBe(false);
  });

  it("convertTextToVariant 转换字形", () => {
    expect(convertTextToVariant("软件", "zh-TW")).toBe("軟件");
    expect(convertTextToVariant("軟", "zh-CN")).toBe("软");
  });

  it("getScriptConverter 对同一变体复用实例", () => {
    expect(getScriptConverter("zh-TW")).toBe(getScriptConverter("zh-TW"));
  });

  it("getScriptSuggestion 在缺少目标变体映射时返回 null", () => {
    const rule: ScriptRule = {
      id: "r",
      kind: "script",
      from: "软",
      toByVariant: { "zh-TW": "軟" },
      contextSensitive: false,
      enabled: true,
      priority: 1,
      source: "builtin",
    };
    expect(getScriptSuggestion(rule, "zh-TW")).toBe("軟");
    expect(getScriptSuggestion(rule, "zh-CN")).toBeNull();
  });
});
