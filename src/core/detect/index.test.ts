import { describe, expect, it } from "vitest";
import type { ExtensionSettingsPatch } from "../../shared/types";
import { DEFAULT_SETTINGS, mergeSettings } from "../storage";
import { detectText } from "./index";

function createSettings(patch: ExtensionSettingsPatch = {}) {
  return mergeSettings(DEFAULT_SETTINGS, patch);
}

describe("detectText", () => {
  it("对重叠命中优先保留最长词汇规则", () => {
    const settings = createSettings({
      defaultVariant: "zh-TW",
      detectionLevel: "standard",
    });

    const issues = detectText({
      text: "这个软件默认很好用。",
      settings,
    });

    expect(issues).toHaveLength(2);
    expect(issues[0]?.type).toBe("variant_term");
    expect(issues[0]?.sourceText).toBe("软件");
    expect(issues[0]?.suggestions[0]?.value).toBe("軟體");
    expect(issues[1]?.sourceText).toBe("默认");
  });

  it("用户强制替换优先级高于内置词汇规则", () => {
    const settings = createSettings({
      defaultVariant: "zh-TW",
      detectionLevel: "standard",
      userDictionary: {
        forceReplaceRules: [
          {
            id: "custom-software",
            variant: "zh-TW",
            from: "软件",
            to: "軟件",
            enabled: true,
          },
        ],
      },
    });

    const issues = detectText({
      text: "软件版本已发布。",
      settings,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.subtype).toBe("user-force-replace");
    expect(issues[0]?.ruleId).toBe("custom-software");
    expect(issues[0]?.suggestions[0]?.value).toBe("軟件");
  });

  it("允许词会抑制整词及其内部单字报警", () => {
    const settings = createSettings({
      defaultVariant: "zh-TW",
      detectionLevel: "standard",
      userDictionary: {
        allowTerms: {
          "zh-TW": ["软件"],
        },
      },
    });

    const issues = detectText({
      text: "软件需要升级。",
      settings,
    });

    expect(issues).toEqual([]);
  });

  it("宽松模式只检测字形，不检测地区词汇", () => {
    const settings = createSettings({
      defaultVariant: "zh-TW",
      detectionLevel: "relaxed",
    });

    const issues = detectText({
      text: "软件和支持都已更新。",
      settings,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe("script");
    expect(issues[0]?.sourceText).toBe("软");
    expect(issues[0]?.suggestions[0]?.value).toBe("軟");
  });

});
