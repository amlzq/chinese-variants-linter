import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../storage";
import { getSupportedVariants, loadRuleBundle } from "./index";

describe("rules", () => {
  it("getSupportedVariants 返回四个变体", () => {
    expect(getSupportedVariants().sort()).toEqual(["zh-CN", "zh-HK", "zh-Hant", "zh-TW"]);
  });

  it("loadRuleBundle 返回非空的内置规则包", () => {
    const bundle = loadRuleBundle(DEFAULT_SETTINGS, "zh-TW");
    expect(Array.isArray(bundle.scriptRules)).toBe(true);
    expect(bundle.scriptRules.length).toBeGreaterThan(0);
    expect(Array.isArray(bundle.termRules)).toBe(true);
    expect(bundle.allowTerms instanceof Set).toBe(true);
  });
});
