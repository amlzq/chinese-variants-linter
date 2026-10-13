import { describe, expect, it } from "vitest";
import {
    CLAUSE_BOUNDS,
    CONTEXT_MAX,
    SENTENCE_BOUNDS,
    computeContextSpan,
    nearestBoundAfter,
    nearestBoundBefore,
} from "./contextClip";

describe("nearestBoundBefore / nearestBoundAfter", () => {
    it("在范围内找到句末符并返回正确偏移", () => {
        const text = "今天天气真好。我们出去散步。";
        // 第二个「我们」的「我」在索引 7
        expect(nearestBoundBefore(text, 0, 7, SENTENCE_BOUNDS)).toBe(7); // 命中「。」(index 6) 之后
        expect(nearestBoundAfter(text, 8, text.length, SENTENCE_BOUNDS)).toBe(13); // 命中第二个「。」(index 13)
    });

    it("范围内无边界时返回原 from / to", () => {
        const text = "没有标点的一段文本";
        expect(nearestBoundBefore(text, 0, 5, SENTENCE_BOUNDS)).toBe(0);
        expect(nearestBoundAfter(text, 0, 5, SENTENCE_BOUNDS)).toBe(5);
    });
});

describe("computeContextSpan", () => {
    it("整句内有标点：节选整句片段（含 term 前最近的句末符之后到 term 后句末符）", () => {
        const text = "今天天气真好。鼠标需要换成滑鼠才符合规范。明天再聊。";
        const start = text.indexOf("鼠标");
        const end = start + "鼠标".length;
        const span = computeContextSpan(text, start, end);
        // 起点应是「。」之后，终点应是 term 后的「。」本身（不含符号）
        expect(text.slice(span.start, span.end)).toBe("鼠标需要换成滑鼠才符合规范");
        expect(span.start).toBe(text.indexOf("鼠标"));
        expect(span.end).toBe(text.indexOf("规范") + "规范".length);
    });

    it("term 在句首：before 为空，省略号仅在真正截断时出现", () => {
        const text = "软件需要升级。系统保持稳定。";
        const start = text.indexOf("软件");
        const end = start + "软件".length;
        const span = computeContextSpan(text, start, end);
        // 句首无前置句末符，segStart 应为 term 起点
        expect(span.start).toBe(start);
        expect(text.slice(span.start, span.end)).toBe("软件需要升级");
    });

    it("句子过长：降级到逗号级，节选不超过 CONTEXT_MAX", () => {
        // 构造一个超长无内部句末符的单句（用逗号分隔），term 在其中
        const longClause = Array.from({ length: 80 }, (_, i) => `词${i}`).join("，");
        const text = `开头。${longClause}。结尾。`;
        const term = "词40";
        const start = text.indexOf(term);
        const end = start + term.length;
        const span = computeContextSpan(text, start, end);
        const excerpt = text.slice(span.start, span.end);
        // 降级后片段长度应被 CLAUSE_SEARCH 约束，远小于整句
        expect(excerpt.length).toBeLessThan(CONTEXT_MAX + term.length);
        // 片段应由逗号级边界包围（两侧是逗号）
        expect(CLAUSE_BOUNDS.includes(text[span.start - 1] ?? "") || span.start === 0).toBe(true);
    });

    it("无标点内容（代码/URL/英文）：窗口兜底，不越界", () => {
        const text = "https://example.com/path/to/resource?query=abcdefghijklmnop";
        const start = text.indexOf("resource");
        const end = start + "resource".length;
        const span = computeContextSpan(text, start, end);
        expect(span.start).toBeGreaterThanOrEqual(0);
        expect(span.end).toBeLessThanOrEqual(text.length);
        expect(text.slice(span.start, span.end)).toContain("resource");
    });

    it("term 紧邻字符串两端：窗口边界正确钳制", () => {
        const text = "短。";
        const start = text.indexOf("短");
        const end = start + "短".length;
        const span = computeContextSpan(text, start, end);
        expect(span.start).toBe(0);
        // 「短。」长度为 2，「。」(index 1)本身作为边界被排除，故 end=1。
        expect(span.end).toBe(1);
        expect(text.slice(span.start, span.end)).toBe("短");
    });
});
