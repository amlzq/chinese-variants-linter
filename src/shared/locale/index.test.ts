import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectDefaultRegion,
  getExtensionName,
  getRegion,
  getShortcutActionLabel,
  getShortcutDescription,
  getVariantLabel,
  setRegion,
  t,
} from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
  setRegion("CN");
});

describe("t", () => {
  it("按地区返回文案", () => {
    setRegion("TW");
    expect(t("review.accept")).toBe("接受");
    setRegion("EN");
    expect(t("review.accept")).toBe("Accept");
  });

  it("插值替换参数", () => {
    setRegion("CN");
    expect(t("review.counter", { current: 2, total: 5 })).toBe("2 / 5");
  });

  it("缺少参数时保留占位符", () => {
    setRegion("CN");
    expect(t("review.counter", { current: 2 })).toBe("2 / {total}");
  });

  it("未知 key 返回 key 本身", () => {
    expect(t("not.exist.key")).toBe("not.exist.key");
  });
});

describe("setRegion / getRegion", () => {
  it("切换地区后读取到新值", () => {
    setRegion("HK");
    expect(getRegion()).toBe("HK");
    setRegion("MO");
    expect(getRegion()).toBe("MO");
  });
});

describe("detectDefaultRegion", () => {
  function stubUILanguage(language: string): void {
    vi.stubGlobal("browser", { i18n: { getUILanguage: () => language } });
  }

  it.each([
    ["zh-TW", "TW"],
    ["zh-Hant-TW", "TW"],
    ["zh-HK", "HK"],
    ["zh-MO", "MO"],
    ["zh-SG", "SG"],
    ["zh-MY", "MY"],
    ["zh-CN", "CN"],
    ["en-US", "EN"],
    ["fr-FR", "CN"],
  ])("界面语言 %s 推断为 %s", (language, region) => {
    stubUILanguage(language);
    expect(detectDefaultRegion()).toBe(region);
  });

  it("i18n 不可用时回退到 navigator.language", () => {
    vi.stubGlobal("navigator", { language: "zh-HK" });
    expect(detectDefaultRegion()).toBe("HK");
  });

  it("读取语言抛错时回退 CN", () => {
    vi.stubGlobal("browser", {
      i18n: {
        getUILanguage: () => {
          throw new Error("boom");
        },
      },
    });
    expect(detectDefaultRegion()).toBe("CN");
  });
});

describe("getVariantLabel / 快捷键文案", () => {
  it("返回各变体的本地化名称", () => {
    setRegion("CN");
    expect(getVariantLabel("zh-CN")).toBe("简体中文");
    expect(getVariantLabel("zh-TW")).toBe("中文（台湾）");
    setRegion("EN");
    expect(getVariantLabel("zh-Hant")).toBe("Traditional Chinese");
  });

  it("返回快捷键操作的名称与说明", () => {
    setRegion("CN");
    expect(getShortcutActionLabel("convertSelection")).toBe("转换当前选区");
    expect(getShortcutDescription("convertSelection")).toContain("目标变体");
  });
});

describe("getExtensionName", () => {
  it("优先使用 manifest 多语言名称", () => {
    vi.stubGlobal("browser", { i18n: { getMessage: () => "变体检查器" } });
    expect(getExtensionName()).toBe("变体检查器");
  });

  it("取不到名称时使用英文回退值", () => {
    vi.stubGlobal("browser", { i18n: { getMessage: () => "" } });
    expect(getExtensionName()).toBe("Chinese Variants Linter");
  });

  it("i18n 抛错时使用回退值", () => {
    vi.stubGlobal("browser", {
      i18n: {
        getMessage: () => {
          throw new Error("boom");
        },
      },
    });
    expect(getExtensionName()).toBe("Chinese Variants Linter");
  });
});
