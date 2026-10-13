// 上下文语义化节选：在约束窗口内优先整句、超长降级到逗号级、无标点则固定窗口兜底。
// 仅在 reviewView 中使用，便于单独单测节选区间计算。

// 句末级边界（优先）：用于截取整句片段。
export const SENTENCE_BOUNDS = ["。", "！", "？", "…", "；", "\n"];
// 句内级边界（句子超长时降级使用）：即「逗号」级。
export const CLAUSE_BOUNDS = [",", "，", "、", "：", "；", "—"];
// 约束窗口半径：约等于 2 行可容纳量，避免触发 line-clamp 二次裁切（可后续微调）。
export const CONTEXT_MAX = 48;
// 句子超长时，在 term 两侧各搜索多少字符找逗号边界。
export const CLAUSE_SEARCH = 12;

/** 从 to 向左找到最近边界符，返回「该符号之后」的偏移（片段起点）。 */
export function nearestBoundBefore(
    text: string,
    from: number,
    to: number,
    bounds: readonly string[],
): number {
    for (let i = to - 1; i >= from; i--) {
        if (bounds.includes(text[i])) {
            return i + 1;
        }
    }
    return from;
}

/** 从 from 向右找到最近边界符，返回「该符号本身」的偏移（片段终点，不含符号）。 */
export function nearestBoundAfter(
    text: string,
    from: number,
    to: number,
    bounds: readonly string[],
): number {
    for (let i = from; i < to; i++) {
        if (bounds.includes(text[i])) {
            return i;
        }
    }
    return to;
}

export interface ContextSpan {
    /** 节选片段起点（含）。 */
    start: number;
    /** 节选片段终点（不含）。 */
    end: number;
}

/**
 * 计算围绕 [start, end) 的语义化上下文节选区间。
 * 三级降级：窗口内整句 → 窗口内逗号子句 → 固定窗口（由调用方用 line-clamp / 省略号兜底）。
 */
export function computeContextSpan(
    fullText: string,
    start: number,
    end: number,
): ContextSpan {
    const winStart = Math.max(0, start - CONTEXT_MAX);
    const winEnd = Math.min(fullText.length, end + CONTEXT_MAX);

    // 1) 句子级：在窗口内找最近句末符。
    let segStart = nearestBoundBefore(fullText, winStart, start, SENTENCE_BOUNDS);
    let segEnd = nearestBoundAfter(fullText, end, winEnd, SENTENCE_BOUNDS);

    // 2) 句子超长 → 降级到逗号级（仅在 term 附近搜索，避免跨句）。
    if (segEnd - segStart > CONTEXT_MAX) {
        segStart = nearestBoundBefore(
            fullText,
            Math.max(winStart, start - CLAUSE_SEARCH),
            start,
            CLAUSE_BOUNDS,
        );
        segEnd = nearestBoundAfter(
            fullText,
            end,
            Math.min(winEnd, end + CLAUSE_SEARCH),
            CLAUSE_BOUNDS,
        );
    }
    // 3) 仍无边界（纯英文/代码/URL/无标点表单）→ segStart/segEnd 已落在窗口内。

    return { start: segStart, end: segEnd };
}
