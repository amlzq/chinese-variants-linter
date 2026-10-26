import { describe, expect, it } from "vitest";
import { TERM_RULES } from "./index";

describe("TERM_RULES", () => {
  it("至少包含 50 条高置信度地区词汇规则", () => {
    expect(TERM_RULES.filter((rule) => rule.safe).length).toBeGreaterThanOrEqual(50);
  });

  it("规则 id 与来源词各不重复", () => {
    const ids = TERM_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    const terms = TERM_RULES.map((rule) => rule.sourceTerm);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("目标词与来源词不同，且每条至少有一个目标", () => {
    for (const rule of TERM_RULES) {
      const targets = Object.values(rule.targets);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets).not.toContain(rule.sourceTerm);
    }
  });

  it("繁体字形的大陆用词也会被识别", () => {
    const rule = TERM_RULES.find((item) => item.sourceTerm === "服務器");
    expect(rule?.targets).toMatchObject({ "zh-TW": "伺服器", "zh-HK": "伺服器", "zh-CN": "服务器" });
  });

  it("单向条目不生成台港 → 大陆规则", () => {
    expect(TERM_RULES.some((rule) => rule.sourceTerm === "番茄")).toBe(false);
    expect(TERM_RULES.some((rule) => rule.sourceTerm === "澳洲")).toBe(false);
  });

  it("有歧义的方向标记为中置信度", () => {
    expect(TERM_RULES.find((rule) => rule.sourceTerm === "支持")?.safe).toBe(false);
    expect(TERM_RULES.find((rule) => rule.sourceTerm === "视频")?.safe).toBe(true);
    expect(TERM_RULES.find((rule) => rule.sourceTerm === "影片")?.safe).toBe(false);
  });

  it("香港面条使用「麪條」", () => {
    expect(TERM_RULES.find((rule) => rule.sourceTerm === "面条")?.targets["zh-HK"]).toBe("麪條");
  });
});
