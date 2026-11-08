import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ExtensionSettings,
  CustomPhrase,
  ShortcutMap,
  UserDictionary,
  VariantCode,
} from "../../shared/types";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isSiteEnabled,
  mergeSettings,
  normalizeSettings,
  saveSettings,
  setSiteEnabled,
  STORAGE_KEY,
  updateSettings,
} from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const local = {
    get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        store.set(key, value);
      }
    }),
  };
  vi.stubGlobal("browser", { storage: { local } });
  return { store, local };
}

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
        phrases: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
      },
    });
    expect(settings.userDictionary.allowTerms["zh-CN"]).toEqual(["foo", "bar"]);
  });

  it("allowTerms 为非数组时被忽略而非抛错", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": "not-an-array" } as unknown as UserDictionary["allowTerms"],
        phrases: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
      },
    });
    expect(settings.userDictionary.allowTerms["zh-CN"]).toEqual([]);
  });

  it("phrases 仅保留 from 非空且类型正确的条目", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        phrases: {
          "zh-TW": [
            { id: "1", from: " 你好 ", to: " 妳好 ", enabled: true },
            { id: "2", from: "", to: "x", enabled: true },
            { from: 123, to: 456 } as unknown as CustomPhrase,
            "garbage" as unknown as CustomPhrase,
          ],
        },
      } as unknown as UserDictionary,
    });
    expect(settings.userDictionary.phrases["zh-TW"]).toHaveLength(1);
    const kept = settings.userDictionary.phrases["zh-TW"][0];
    expect(kept.from).toBe("你好");
    expect(kept.to).toBe("妳好");
  });

  it("phrases 按变体分开存放", () => {
    const settings = normalizeSettings({
      userDictionary: {
        phrases: {
          "zh-TW": [{ id: "a", from: "视频", to: "影片", enabled: true }],
          "zh-HK": [{ id: "b", from: "视频", to: "影片", enabled: true }],
        },
      } as unknown as UserDictionary,
    });
    expect(settings.userDictionary.phrases["zh-TW"].map((p) => p.id)).toEqual(["a"]);
    expect(settings.userDictionary.phrases["zh-HK"].map((p) => p.id)).toEqual(["b"]);
    expect(settings.userDictionary.phrases["zh-CN"]).toEqual([]);
  });

  it("迁移旧版 forceReplaceRules 到对应变体，非法 variant 被丢弃", () => {
    const settings = normalizeSettings({
      userDictionary: {
        forceReplaceRules: [
          { id: "1", variant: "zh-TW", from: "视频", to: "影片", enabled: true },
          { id: "2", variant: "zh-HK", from: "软件", to: "軟件", enabled: false },
          { id: "3", variant: "xx", from: "a", to: "b", enabled: true },
        ],
      } as unknown as UserDictionary,
    });
    expect(settings.userDictionary.phrases["zh-TW"].map((p) => p.id)).toEqual(["1"]);
    expect(settings.userDictionary.phrases["zh-HK"]).toEqual([
      { id: "2", from: "软件", to: "軟件", enabled: false },
    ]);
    expect("forceReplaceRules" in settings.userDictionary).toBe(false);
  });

  it("已有新版 phrases 的变体不再吸收旧版数据", () => {
    const settings = normalizeSettings({
      userDictionary: {
        phrases: { "zh-TW": [{ id: "new", from: "a", to: "b", enabled: true }] },
        forceReplaceRules: [{ id: "old", variant: "zh-TW", from: "c", to: "d", enabled: true }],
      } as unknown as UserDictionary,
    });
    expect(settings.userDictionary.phrases["zh-TW"].map((p) => p.id)).toEqual(["new"]);
  });

  it("未提供 userDictionary 时返回空字典", () => {
    const settings = normalizeSettings({});
    expect(settings.userDictionary.allowTerms["zh-CN"]).toEqual([]);
    expect(settings.userDictionary.phrases["zh-TW"]).toEqual([]);
  });

  it("缺少 defaultSiteEnabled 时默认为关闭", () => {
    const settings = normalizeSettings({});
    expect(settings.defaultSiteEnabled).toBe(false);
  });

  it("缺少 shortcuts 时回退到默认快捷键", () => {
    const settings = normalizeSettings({});
    expect(settings.shortcuts.toggleEnabled).toEqual(DEFAULT_SETTINGS.shortcuts.toggleEnabled);
  });

  it("部分 shortcuts 与默认值合并", () => {
    const settings = normalizeSettings({
      shortcuts: { acceptNext: null } as ShortcutMap,
    });
    expect(settings.shortcuts.acceptNext).toBeNull();
    expect(settings.shortcuts.toggleEnabled).toEqual(DEFAULT_SETTINGS.shortcuts.toggleEnabled);
  });

  it("phrases 缺少 id 时生成稳定回退 id，enabled 默认开启", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        phrases: {
          "zh-TW": [{ from: "视频", to: "影片" } as CustomPhrase],
        },
      } as unknown as UserDictionary,
    });
    const rule = settings.userDictionary.phrases["zh-TW"][0];
    expect(rule.id).toBe("phrase-0");
    expect(rule.enabled).toBe(true);
  });
});

describe("mergeSettings", () => {
  it("深层合并 siteEnabledMap，保留未涉及的站点", () => {
    const current = mergeSettings(DEFAULT_SETTINGS, {
      siteEnabledMap: { "a.com": true, "b.com": true },
    });
    const next = mergeSettings(current, { siteEnabledMap: { "b.com": false } });
    expect(next.siteEnabledMap).toEqual({ "a.com": true, "b.com": false });
  });

  it("深层合并 allowTerms，保留其它变体已有词", () => {
    const current = mergeSettings(DEFAULT_SETTINGS, {
      userDictionary: { allowTerms: { "zh-TW": ["滑鼠"], "zh-CN": ["软件"] } },
    });
    const next = mergeSettings(current, {
      userDictionary: { allowTerms: { "zh-TW": ["滑鼠", "軟體"] } },
    });
    expect(next.userDictionary.allowTerms["zh-TW"]).toEqual(["滑鼠", "軟體"]);
    expect(next.userDictionary.allowTerms["zh-CN"]).toEqual(["软件"]);
  });

  it("phrases 补丁只替换对应变体，其余保留", () => {
    const current = mergeSettings(DEFAULT_SETTINGS, {
      userDictionary: {
        phrases: {
          "zh-TW": [{ id: "a", from: "软件", to: "軟體", enabled: true }],
          "zh-HK": [{ id: "h", from: "软件", to: "軟件", enabled: true }],
        },
      },
    });
    const next = mergeSettings(current, {
      userDictionary: {
        phrases: {
          "zh-TW": [{ id: "b", from: "视频", to: "影片", enabled: true }],
        },
      },
    });
    expect(next.userDictionary.phrases["zh-TW"].map((rule) => rule.id)).toEqual(["b"]);
    expect(next.userDictionary.phrases["zh-HK"].map((rule) => rule.id)).toEqual(["h"]);
  });

  it("部分 shortcuts 补丁只覆盖对应项", () => {
    const next = mergeSettings(DEFAULT_SETTINGS, {
      shortcuts: { convertSelection: { ctrl: false, meta: true, alt: false, shift: false, key: "K" } },
    });
    expect(next.shortcuts.convertSelection?.meta).toBe(true);
    expect(next.shortcuts.toggleEnabled).toEqual(DEFAULT_SETTINGS.shortcuts.toggleEnabled);
  });
});

describe("isSiteEnabled", () => {
  it("无 hostname 时跟随全站点默认开关", () => {
    expect(isSiteEnabled(DEFAULT_SETTINGS, null)).toBe(false);
    expect(isSiteEnabled({ ...DEFAULT_SETTINGS, defaultSiteEnabled: true }, null)).toBe(true);
  });

  it("未记录的站点跟随全站点默认开关", () => {
    expect(isSiteEnabled(DEFAULT_SETTINGS, "unknown.com")).toBe(false);
    expect(isSiteEnabled({ ...DEFAULT_SETTINGS, defaultSiteEnabled: true }, "unknown.com")).toBe(
      true,
    );
  });

  it("站点级开关优先于全站点默认开关", () => {
    const settings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      defaultSiteEnabled: true,
      siteEnabledMap: { "off.com": false, "on.com": true },
    };
    expect(isSiteEnabled(settings, "off.com")).toBe(false);
    expect(isSiteEnabled(settings, "on.com")).toBe(true);
    expect(isSiteEnabled(settings, "other.com")).toBe(true);
  });
});

describe("持久化读写", () => {
  it("getSettings 对存储内容做规范化", async () => {
    stubStorage({
      [STORAGE_KEY]: {
        enabled: false,
        defaultVariant: "zh-HK",
        userDictionary: {
          allowTerms: { "zh-HK": [" foo ", "foo"] },
          phrases: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        },
      },
    });

    const settings = await getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.defaultVariant).toBe("zh-HK");
    expect(settings.userDictionary.allowTerms["zh-HK"]).toEqual(["foo"]);
  });

  it("存储为空时返回默认设置", async () => {
    stubStorage();
    const settings = await getSettings();
    expect(settings.detectionLevel).toBe(DEFAULT_SETTINGS.detectionLevel);
    expect(settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
  });

  it("saveSettings 规范化后写入存储", async () => {
    const { local, store } = stubStorage();
    await saveSettings({
      ...DEFAULT_SETTINGS,
      userDictionary: {
        allowTerms: { "zh-CN": [" 词 "], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        phrases: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
      },
    });

    expect(local.set).toHaveBeenCalledTimes(1);
    const saved = store.get(STORAGE_KEY) as ExtensionSettings;
    expect(saved.userDictionary.allowTerms["zh-CN"]).toEqual(["词"]);
  });

  it("updateSettings 读取当前值后合并补丁", async () => {
    stubStorage({ [STORAGE_KEY]: { ...DEFAULT_SETTINGS, enabled: true } });

    const settings = await updateSettings({ enabled: false, detectionLevel: "relaxed" });
    expect(settings.enabled).toBe(false);
    expect(settings.detectionLevel).toBe("relaxed");
  });

  it("setSiteEnabled 写入站点开关", async () => {
    const { store } = stubStorage();
    const settings = await setSiteEnabled("example.com", false);
    expect(settings.siteEnabledMap["example.com"]).toBe(false);
    expect((store.get(STORAGE_KEY) as ExtensionSettings).siteEnabledMap["example.com"]).toBe(false);
  });
});

describe("normalizeSettings - 数量上限", () => {
  it("允许词超过上限时截断", () => {
    const terms = Array.from({ length: 1010 }, (_, index) => `词${index}`);
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": terms, "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        phrases: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
      },
    });

    expect(settings.userDictionary.allowTerms["zh-CN"]).toHaveLength(1000);
  });

  it("自定义词组超过上限时截断", () => {
    const rules = Array.from({ length: 1010 }, (_, index) => ({
      id: `r-${index}`,
      from: `a${index}`,
      to: `b${index}`,
      enabled: true,
    }));
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        phrases: { "zh-TW": rules },
      } as unknown as UserDictionary,
    });

    expect(settings.userDictionary.phrases["zh-TW"]).toHaveLength(1000);
  });
});

describe("detectDefaultVariant - 按浏览器语言推断", () => {
  async function loadDefaultVariant(language: string | undefined): Promise<VariantCode> {
    const original = Object.getOwnPropertyDescriptor(navigator, "language");
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => language ?? "",
    });
    try {
      vi.resetModules();
      const mod = await import("./index");
      return mod.DEFAULT_SETTINGS.defaultVariant;
    } finally {
      if (original) {
        Object.defineProperty(navigator, "language", original);
      } else {
        Reflect.deleteProperty(navigator, "language");
      }
    }
  }

  it.each([
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-HK"],
    ["zh-MO", "zh-HK"],
    ["zh-Hant-TW", "zh-TW"],
    ["zh-Hant", "zh-Hant"],
    ["zh-CN", "zh-CN"],
    ["en-US", "zh-CN"],
    [undefined, "zh-CN"],
  ])("language=%s 时回退到 %s", async (language, expected) => {
    await expect(loadDefaultVariant(language)).resolves.toBe(expected);
  });
});
