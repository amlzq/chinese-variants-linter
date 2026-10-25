import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ExtensionSettings,
  ForceReplaceRule,
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

  it("forceReplaceRules 缺少 id 时生成稳定回退 id，enabled 默认开启", () => {
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        forceReplaceRules: [
          { variant: "zh-TW", from: "视频", to: "影片" } as ForceReplaceRule,
        ],
      },
    });
    const rule = settings.userDictionary.forceReplaceRules[0];
    expect(rule.id).toBe("fr-0");
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

  it("forceReplaceRules 以补丁整体替换", () => {
    const current = mergeSettings(DEFAULT_SETTINGS, {
      userDictionary: {
        forceReplaceRules: [
          { id: "a", variant: "zh-TW", from: "软件", to: "軟體", enabled: true },
        ],
      },
    });
    const next = mergeSettings(current, {
      userDictionary: {
        forceReplaceRules: [
          { id: "b", variant: "zh-TW", from: "视频", to: "影片", enabled: true },
        ],
      },
    });
    expect(next.userDictionary.forceReplaceRules.map((rule) => rule.id)).toEqual(["b"]);
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
  it("无 hostname 时视为启用", () => {
    expect(isSiteEnabled(DEFAULT_SETTINGS, null)).toBe(true);
  });

  it("未记录的站点默认启用", () => {
    expect(isSiteEnabled(DEFAULT_SETTINGS, "unknown.com")).toBe(true);
  });

  it("站点被显式关闭时为 false", () => {
    const settings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      siteEnabledMap: { "off.com": false, "on.com": true },
    };
    expect(isSiteEnabled(settings, "off.com")).toBe(false);
    expect(isSiteEnabled(settings, "on.com")).toBe(true);
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
          forceReplaceRules: [],
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
        forceReplaceRules: [],
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
        forceReplaceRules: [],
      },
    });

    expect(settings.userDictionary.allowTerms["zh-CN"]).toHaveLength(1000);
  });

  it("强制替换规则超过上限时截断", () => {
    const rules = Array.from({ length: 1010 }, (_, index) => ({
      id: `r-${index}`,
      variant: "zh-TW" as VariantCode,
      from: `a${index}`,
      to: `b${index}`,
      enabled: true,
    }));
    const settings = normalizeSettings({
      userDictionary: {
        allowTerms: { "zh-CN": [], "zh-TW": [], "zh-HK": [], "zh-Hant": [] },
        forceReplaceRules: rules,
      },
    });

    expect(settings.userDictionary.forceReplaceRules).toHaveLength(1000);
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
