import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../core/storage";
import {
  addPhrasePatch,
  allowPhrasesPatch,
  clearPhrasesPatch,
  importPhrasesPatch,
  removeAllowPhrasePatch,
  removePhrasePatch,
  updatePhrasePatch,
} from "./settingsHelpers";
import type { ExtensionSettings, ExtensionSettingsPatch } from "./types";

function createSettings(patch: ExtensionSettingsPatch = {}): ExtensionSettings {
  return mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW", ...patch });
}

describe("allowPhrasesPatch", () => {
  it("向当前目标变体追加去除空白后的允许词", () => {
    const patch = allowPhrasesPatch(createSettings(), "  軟體  ");
    expect(patch.userDictionary?.allowPhrases?.["zh-TW"]).toEqual(["軟體"]);
  });

  it("保留已有允许词并去重", () => {
    const settings = createSettings({
      userDictionary: { allowPhrases: { "zh-TW": ["軟體", "滑鼠"] } },
    });
    const patch = allowPhrasesPatch(settings, "滑鼠");
    expect(patch).toEqual({});
  });

  it("空词或纯空白返回空补丁", () => {
    expect(allowPhrasesPatch(createSettings(), "")).toEqual({});
    expect(allowPhrasesPatch(createSettings(), "   ")).toEqual({});
  });
});

describe("removeAllowPhrasePatch", () => {
  it("仅移除指定词，保留其余词", () => {
    const settings = createSettings({
      userDictionary: { allowPhrases: { "zh-TW": ["軟體", "滑鼠"] } },
    });
    const patch = removeAllowPhrasePatch(settings, "軟體");
    expect(patch.userDictionary?.allowPhrases?.["zh-TW"]).toEqual(["滑鼠"]);
  });

  it("词不存在时列表保持不变", () => {
    const settings = createSettings({
      userDictionary: { allowPhrases: { "zh-TW": ["滑鼠"] } },
    });
    const patch = removeAllowPhrasePatch(settings, "不存在");
    expect(patch.userDictionary?.allowPhrases?.["zh-TW"]).toEqual(["滑鼠"]);
  });
});

describe("addPhrasePatch", () => {
  it("向指定变体追加带 id 的词组并 trim 两端空白", () => {
    const patch = addPhrasePatch(createSettings(), "zh-TW", " 视频 ", " 影片 ");
    const phrases = patch.userDictionary?.phrases?.["zh-TW"] ?? [];
    expect(phrases).toHaveLength(1);
    expect(phrases[0]?.from).toBe("视频");
    expect(phrases[0]?.to).toBe("影片");
    expect(phrases[0]?.enabled).toBe(true);
    expect(phrases[0]?.id).toMatch(/^phrase-/);
    expect(Object.keys(patch.userDictionary?.phrases ?? {})).toEqual(["zh-TW"]);
  });

  it("按传入变体分开存放，不看 defaultVariant", () => {
    const patch = addPhrasePatch(createSettings({ defaultVariant: "zh-TW" }), "zh-HK", "视频", "影片");
    expect(Object.keys(patch.userDictionary?.phrases ?? {})).toEqual(["zh-HK"]);
  });

  it("原词或替换词为空时返回空补丁", () => {
    const settings = createSettings();
    expect(addPhrasePatch(settings, "zh-TW", "", "影片")).toEqual({});
    expect(addPhrasePatch(settings, "zh-TW", "视频", "   ")).toEqual({});
  });

  it("在已有词组之后追加", () => {
    const settings = createSettings({
      userDictionary: {
        phrases: { "zh-TW": [{ id: "old", from: "软件", to: "軟體", enabled: true }] },
      },
    });
    const phrases = addPhrasePatch(settings, "zh-TW", "视频", "影片").userDictionary?.phrases?.["zh-TW"];
    expect(phrases?.map((p) => (p.id.startsWith("old") ? "old" : "new"))).toEqual(["old", "new"]);
  });
});

const twPhrases = {
  "zh-TW": [
    { id: "a", from: "软件", to: "軟體", enabled: true },
    { id: "b", from: "视频", to: "影片", enabled: true },
  ],
};

describe("updatePhrasePatch", () => {
  it("按 id 修改原词与替换词并保留其余字段", () => {
    const settings = createSettings({ userDictionary: { phrases: twPhrases } });
    const phrases = updatePhrasePatch(settings, "zh-TW", "a", " 軟件 ", " 软体 ").userDictionary?.phrases?.["zh-TW"];
    expect(phrases?.[0]).toEqual({ id: "a", from: "軟件", to: "软体", enabled: true });
    expect(phrases?.[1]?.id).toBe("b");
  });

  it("空值返回空补丁", () => {
    const settings = createSettings({ userDictionary: { phrases: twPhrases } });
    expect(updatePhrasePatch(settings, "zh-TW", "a", "", "x")).toEqual({});
  });
});

describe("removePhrasePatch", () => {
  it("按 id 移除指定变体下的词组", () => {
    const settings = createSettings({ userDictionary: { phrases: twPhrases } });
    const phrases = removePhrasePatch(settings, "zh-TW", "a").userDictionary?.phrases?.["zh-TW"];
    expect(phrases?.map((p) => p.id)).toEqual(["b"]);
  });

  it("id 不存在时词组数量不变", () => {
    const settings = createSettings({ userDictionary: { phrases: twPhrases } });
    const phrases = removePhrasePatch(settings, "zh-TW", "missing").userDictionary?.phrases?.["zh-TW"];
    expect(phrases).toHaveLength(2);
  });
});

describe("clearPhrasesPatch", () => {
  it("只清空指定变体", () => {
    expect(clearPhrasesPatch("zh-HK")).toEqual({ userDictionary: { phrases: { "zh-HK": [] } } });
  });
});

describe("importPhrasesPatch", () => {
  it("原词已存在则更新替换词，否则追加", () => {
    const settings = createSettings({ userDictionary: { phrases: twPhrases } });
    const phrases = importPhrasesPatch(settings, "zh-TW", [
      { from: "软件", to: "軟件" },
      { from: "鼠标", to: "滑鼠" },
    ]).userDictionary?.phrases?.["zh-TW"];
    expect(phrases?.map((p) => [p.from, p.to])).toEqual([
      ["软件", "軟件"],
      ["视频", "影片"],
      ["鼠标", "滑鼠"],
    ]);
    expect(phrases?.[0]?.id).toBe("a");
    expect(new Set(phrases?.map((p) => p.id)).size).toBe(3);
  });

  it("没有可导入的行时返回空补丁", () => {
    expect(importPhrasesPatch(createSettings(), "zh-TW", [])).toEqual({});
  });
});
