import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../core/storage";
import {
  addPhrasePatch,
  allowTermsPatch,
  removeAllowTermPatch,
  removePhrasePatch,
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

describe("addPhrasePatch", () => {
  it("向当前目标变体追加带 id 的词组并 trim 两端空白", () => {
    const patch = addPhrasePatch(createSettings(), " 视频 ", " 影片 ");
    const phrases = patch.userDictionary?.phrases?.["zh-TW"] ?? [];
    expect(phrases).toHaveLength(1);
    expect(phrases[0]?.from).toBe("视频");
    expect(phrases[0]?.to).toBe("影片");
    expect(phrases[0]?.enabled).toBe(true);
    expect(phrases[0]?.id).toMatch(/^phrase-/);
    expect(Object.keys(patch.userDictionary?.phrases ?? {})).toEqual(["zh-TW"]);
  });

  it("按「我使用的写法」分开存放", () => {
    const patch = addPhrasePatch(createSettings({ defaultVariant: "zh-HK" }), "视频", "影片");
    expect(Object.keys(patch.userDictionary?.phrases ?? {})).toEqual(["zh-HK"]);
  });

  it("原词或替换词为空时返回空补丁", () => {
    const settings = createSettings();
    expect(addPhrasePatch(settings, "", "影片")).toEqual({});
    expect(addPhrasePatch(settings, "视频", "   ")).toEqual({});
  });

  it("在已有词组之后追加", () => {
    const settings = createSettings({
      userDictionary: {
        phrases: { "zh-TW": [{ id: "old", from: "软件", to: "軟體", enabled: true }] },
      },
    });
    const phrases = addPhrasePatch(settings, "视频", "影片").userDictionary?.phrases?.["zh-TW"];
    expect(phrases?.map((p) => (p.id.startsWith("old") ? "old" : "new"))).toEqual(["old", "new"]);
  });
});

describe("removePhrasePatch", () => {
  it("按 id 移除当前变体下的词组", () => {
    const settings = createSettings({
      userDictionary: {
        phrases: {
          "zh-TW": [
            { id: "a", from: "软件", to: "軟體", enabled: true },
            { id: "b", from: "视频", to: "影片", enabled: true },
          ],
        },
      },
    });
    const phrases = removePhrasePatch(settings, "a").userDictionary?.phrases?.["zh-TW"];
    expect(phrases?.map((p) => p.id)).toEqual(["b"]);
  });

  it("id 不存在时词组数量不变", () => {
    const settings = createSettings({
      userDictionary: {
        phrases: { "zh-TW": [{ id: "a", from: "软件", to: "軟體", enabled: true }] },
      },
    });
    const phrases = removePhrasePatch(settings, "missing").userDictionary?.phrases?.["zh-TW"];
    expect(phrases).toHaveLength(1);
  });
});
