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

  it("空白文本不产生任何问题", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    expect(detectText({ text: "", settings })).toEqual([]);
    expect(detectText({ text: "   \n\t", settings })).toEqual([]);
  });

  it("忽略列表中的 issue 不再报告", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const first = detectText({ text: "软件默认", settings });
    expect(first).toHaveLength(2);

    const issues = detectText({
      text: "软件默认",
      settings,
      ignoredIssueIds: [first[1]!.id],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.sourceText).toBe("软件");
  });

  it("忽略词汇问题后，同位置的单字问题会作为回退出现", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const first = detectText({ text: "软件", settings });
    const issues = detectText({
      text: "软件",
      settings,
      ignoredIssueIds: [first[0]!.id],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe("script");
    expect(issues[0]?.sourceText).toBe("软");
  });

  it("同一词重复出现时逐个报告", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const issues = detectText({ text: "软件软件", settings });
    expect(issues.map((issue) => issue.start)).toEqual([0, 2]);
  });

  it("词汇命中会遮蔽其内部单字，避免重复报告", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const issues = detectText({ text: "软件", settings });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe("variant_term");
  });

  it("返回结果按起点排序且互不重叠", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const issues = detectText({ text: "默认软件支持视频", settings });

    for (let i = 1; i < issues.length; i++) {
      expect(issues[i]!.start).toBeGreaterThanOrEqual(issues[i - 1]!.end);
    }
  });

  it("香港变体使用本地化词汇", () => {
    const settings = createSettings({ defaultVariant: "zh-HK" });
    const issues = detectText({ text: "软件", settings });
    expect(issues[0]?.suggestions[0]?.value).toBe("軟件");
    expect(issues[0]?.targetVariant).toBe("zh-HK");
  });

  it("繁体目标变体可反向检测并给出简体建议", () => {
    const settings = createSettings({ defaultVariant: "zh-CN" });
    const issues = detectText({ text: "軟體", settings });
    expect(issues[0]?.sourceText).toBe("軟體");
    expect(issues[0]?.suggestions[0]?.value).toBe("软件");
  });

  it("宽松模式下允许词同样抑制词内单字", () => {
    const settings = createSettings({
      defaultVariant: "zh-TW",
      detectionLevel: "relaxed",
      userDictionary: {
        allowTerms: { "zh-TW": ["软件"] },
      },
    });
    expect(detectText({ text: "软件", settings })).toEqual([]);
  });

  it("上下文敏感字形标记为中置信度", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const issues = detectText({ text: "这里", settings });
    const issue = issues.find((item) => item.type === "script");
    expect(issue?.sourceText).toBe("里");
    expect(issue?.confidence).toBe("medium");
    expect(issue?.subtype).toBe("context-sensitive-char");
    expect(issue?.suggestions[0]?.value).toBe("裡");
  });

  it("上下文无关字形标记为高置信度", () => {
    const settings = createSettings({ defaultVariant: "zh-TW" });
    const issues = detectText({ text: "电视", settings });
    const issue = issues.find((item) => item.sourceText === "视");
    expect(issue?.confidence).toBe("high");
    expect(issue?.subtype).toBe("safe-char");
  });

  it("用户规则未启用的条目不生效", () => {
    const settings = createSettings({
      defaultVariant: "zh-TW",
      userDictionary: {
        forceReplaceRules: [
          { id: "off", variant: "zh-TW", from: "软件", to: "軟件", enabled: false },
        ],
      },
    });
    const issues = detectText({ text: "软件", settings });
    expect(issues[0]?.subtype).toBe("builtin-term");
    expect(issues[0]?.suggestions[0]?.value).toBe("軟體");
  });
});
