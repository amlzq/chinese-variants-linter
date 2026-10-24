import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../core/storage";
import {
  addForceRulePatch,
  allowTermsPatch,
  removeAllowTermPatch,
  removeForceRulePatch,
} from "./settingsHelpers";
import type { ExtensionSettings, ExtensionSettingsPatch } from "./types";

function createSettings(patch: ExtensionSettingsPatch = {}): ExtensionSettings {
  return mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW", ...patch });
}

describe("allowTermsPatch", () => {
  it("向当前目标变体追加去除空白后的允许词", () => {
    const patch = allowTermsPatch(createSettings(), "  軟體  ");
    expect(patch.userDictionary?.allowTerms?.["zh-TW"]).toEqual(["軟體"]);
  });

  it("保留已有允许词并去重", () => {
    const settings = createSettings({
      userDictionary: { allowTerms: { "zh-TW": ["軟體", "滑鼠"] } },
    });
    const patch = allowTermsPatch(settings, "滑鼠");
    expect(patch).toEqual({});
  });

  it("空词或纯空白返回空补丁", () => {
    expect(allowTermsPatch(createSettings(), "")).toEqual({});
    expect(allowTermsPatch(createSettings(), "   ")).toEqual({});
  });
});

describe("removeAllowTermPatch", () => {
  it("仅移除指定词，保留其余词", () => {
    const settings = createSettings({
      userDictionary: { allowTerms: { "zh-TW": ["軟體", "滑鼠"] } },
    });
    const patch = removeAllowTermPatch(settings, "軟體");
    expect(patch.userDictionary?.allowTerms?.["zh-TW"]).toEqual(["滑鼠"]);
  });

  it("词不存在时列表保持不变", () => {
    const settings = createSettings({
      userDictionary: { allowTerms: { "zh-TW": ["滑鼠"] } },
    });
    const patch = removeAllowTermPatch(settings, "不存在");
    expect(patch.userDictionary?.allowTerms?.["zh-TW"]).toEqual(["滑鼠"]);
  });
});

describe("addForceRulePatch", () => {
  it("追加带 id 的强制替换规则并 trim 两端空白", () => {
    const patch = addForceRulePatch(createSettings(), "zh-TW", " 视频 ", " 影片 ");
    const rules = patch.userDictionary?.forceReplaceRules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.from).toBe("视频");
    expect(rules[0]?.to).toBe("影片");
    expect(rules[0]?.variant).toBe("zh-TW");
    expect(rules[0]?.enabled).toBe(true);
    expect(rules[0]?.id).toMatch(/^force-/);
  });

  it("原词或替换词为空时返回空补丁", () => {
    const settings = createSettings();
    expect(addForceRulePatch(settings, "zh-TW", "", "影片")).toEqual({});
    expect(addForceRulePatch(settings, "zh-TW", "视频", "   ")).toEqual({});
  });

  it("在已有规则之后追加", () => {
    const settings = createSettings({
      userDictionary: {
        forceReplaceRules: [
          { id: "old", variant: "zh-TW", from: "软件", to: "軟體", enabled: true },
        ],
      },
    });
    const rules = addForceRulePatch(settings, "zh-TW", "视频", "影片").userDictionary
      ?.forceReplaceRules;
    expect(rules?.map((rule) => rule.id.startsWith("old") ? "old" : "new")).toEqual([
      "old",
      "new",
    ]);
  });
});

describe("removeForceRulePatch", () => {
  it("按 id 移除规则", () => {
    const settings = createSettings({
      userDictionary: {
        forceReplaceRules: [
          { id: "a", variant: "zh-TW", from: "软件", to: "軟體", enabled: true },
          { id: "b", variant: "zh-TW", from: "视频", to: "影片", enabled: true },
        ],
      },
    });
    const rules = removeForceRulePatch(settings, "a").userDictionary?.forceReplaceRules;
    expect(rules?.map((rule) => rule.id)).toEqual(["b"]);
  });

  it("id 不存在时规则数量不变", () => {
    const settings = createSettings({
      userDictionary: {
        forceReplaceRules: [
          { id: "a", variant: "zh-TW", from: "软件", to: "軟體", enabled: true },
        ],
      },
    });
    const rules = removeForceRulePatch(settings, "missing").userDictionary?.forceReplaceRules;
    expect(rules).toHaveLength(1);
  });
});
