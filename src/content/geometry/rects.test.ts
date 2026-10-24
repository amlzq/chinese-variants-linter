import { afterEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../../shared/types";
import type { RectLike } from "./rects";
import {
  getContenteditableRects,
  getRangeSelectionRect,
  getSelectionOffsets,
  getSelectionRect,
  getTextControlRects,
  getTextControlSelectionRect,
  isTextControl,
  measureIssueRects,
  normalizeRect,
  unionRects,
} from "./rects";

function createIssue(start: number, end: number, sourceText = "软件"): Issue {
  return {
    id: "issue-1",
    type: "variant_term",
    subtype: "builtin-term",
    sourceText,
    targetVariant: "zh-TW",
    start,
    end,
    confidence: "high",
    message: "message",
    suggestions: [{ value: "軟體", label: "label", isDefault: true }],
    ruleId: "rule",
    replaceMode: "single-only",
    status: "active",
  };
}

function rectList(...rects: Array<[number, number, number, number]>): DOMRectList {
  return rects.map(([left, top, right, bottom]) => rect(left, top, right, bottom)) as unknown as DOMRectList;
}

function stubClientRects(rects: DOMRectList): void {
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue(rects);
}

// jsdom 未实现 Range#getClientRects，测试中临时补充。
function stubRangeClientRects(rects: DOMRectList): void {
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => rects,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
});

function rect(left: number, top: number, right: number, bottom: number): RectLike {
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

describe("normalizeRect", () => {
  it("提取 DOMRect 的六个几何字段", () => {
    const domRect = {
      left: 1,
      top: 2,
      right: 11,
      bottom: 22,
      width: 10,
      height: 20,
      x: 1,
      y: 2,
      toJSON: () => ({}),
    } as DOMRect;
    expect(normalizeRect(domRect)).toEqual({
      left: 1,
      top: 2,
      right: 11,
      bottom: 22,
      width: 10,
      height: 20,
    });
  });
});

describe("unionRects", () => {
  it("空数组返回 null", () => {
    expect(unionRects([])).toBeNull();
  });

  it("单个矩形原样返回几何值", () => {
    expect(unionRects([rect(1, 2, 3, 4)])).toEqual(rect(1, 2, 3, 4));
  });

  it("多个矩形取外包矩形", () => {
    expect(unionRects([rect(10, 10, 20, 20), rect(0, 5, 5, 8), rect(15, 0, 30, 12)])).toEqual(
      rect(0, 0, 30, 20),
    );
  });
});

describe("isTextControl", () => {
  it("textarea / input 为文本控件", () => {
    expect(isTextControl(document.createElement("textarea"))).toBe(true);
    expect(isTextControl(document.createElement("input"))).toBe(true);
  });

  it("普通元素不是文本控件", () => {
    expect(isTextControl(document.createElement("div"))).toBe(false);
  });
});

describe("getSelectionOffsets", () => {
  it("文本框返回选区起止偏移", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "你好世界";
    textarea.setSelectionRange(1, 3);
    expect(getSelectionOffsets(textarea)).toEqual({ start: 1, end: 3 });
  });

  it("光标态返回折叠区间", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = "abcdef";
    input.setSelectionRange(2, 2);
    expect(getSelectionOffsets(input)).toEqual({ start: 2, end: 2 });
  });

  it("contenteditable 按元素文本坐标计算偏移", () => {
    const element = document.createElement("div");
    element.textContent = "你好世界";
    document.body.append(element);

    const range = document.createRange();
    range.setStart(element.firstChild as Text, 1);
    range.setEnd(element.firstChild as Text, 3);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getSelectionOffsets(element)).toEqual({ start: 1, end: 3 });
  });

  it("选区不在该元素内时返回 null", () => {
    const element = document.createElement("div");
    element.textContent = "你好";
    const other = document.createElement("div");
    other.textContent = "世界";
    document.body.append(element, other);

    const range = document.createRange();
    range.selectNodeContents(other);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getSelectionOffsets(element)).toBeNull();
  });

  it("没有选区时返回 null", () => {
    window.getSelection()?.removeAllRanges();
    expect(getSelectionOffsets(document.createElement("div"))).toBeNull();
  });
});

describe("getTextControlRects", () => {
  it("用镜像节点测量并过滤零尺寸矩形", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "前面软件后面";
    textarea.getBoundingClientRect = () => rect(10, 20, 210, 60) as DOMRect;
    document.body.append(textarea);
    stubClientRects(rectList([40, 30, 60, 50], [0, 0, 0, 0]));

    const bodyChildren = document.body.children.length;
    const rects = getTextControlRects(textarea, createIssue(2, 4));

    expect(rects).toEqual([rect(40, 30, 60, 50)]);
    // 镜像节点测量后被移除
    expect(document.body.children.length).toBe(bodyChildren);
  });

  it("区间为空文本时使用 sourceText 占位", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "abc";
    document.body.append(textarea);
    stubClientRects(rectList([1, 2, 3, 4]));

    expect(getTextControlRects(textarea, createIssue(1, 1, "软"))).toEqual([rect(1, 2, 3, 4)]);
  });
});

describe("getContenteditableRects", () => {
  it("跨文本节点测量 range 矩形", () => {
    const element = document.createElement("div");
    element.append("前面", document.createElement("b"), "软件", "后面");
    document.body.append(element);
    stubRangeClientRects(rectList([5, 6, 25, 26]));

    expect(getContenteditableRects(element, createIssue(5, 7))).toEqual([rect(5, 6, 25, 26)]);
  });

  it("偏移超出文本长度时收敛到最后一个文本节点", () => {
    const element = document.createElement("div");
    element.textContent = "软件";
    document.body.append(element);
    stubRangeClientRects(rectList([0, 0, 10, 10]));

    expect(getContenteditableRects(element, createIssue(0, 99))).toEqual([rect(0, 0, 10, 10)]);
  });

  it("没有文本节点时返回空数组", () => {
    const element = document.createElement("div");
    document.body.append(element);
    expect(getContenteditableRects(element, createIssue(0, 1))).toEqual([]);
  });

  it("过滤零尺寸矩形", () => {
    const element = document.createElement("div");
    element.textContent = "软件";
    document.body.append(element);
    stubRangeClientRects(rectList([0, 0, 0, 0]));

    expect(getContenteditableRects(element, createIssue(0, 1))).toEqual([]);
  });
});

describe("measureIssueRects", () => {
  it("文本控件走镜像测量", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "软件";
    document.body.append(textarea);
    stubClientRects(rectList([1, 1, 5, 5]));

    expect(measureIssueRects(textarea, createIssue(0, 1))).toEqual([rect(1, 1, 5, 5)]);
  });

  it("contenteditable 走 range 测量", () => {
    const element = document.createElement("div");
    element.textContent = "软件";
    document.body.append(element);
    stubRangeClientRects(rectList([2, 2, 6, 6]));

    expect(measureIssueRects(element, createIssue(0, 1))).toEqual([rect(2, 2, 6, 6)]);
  });
});

describe("getTextControlSelectionRect", () => {
  it("光标折叠时返回 null", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "文本";
    textarea.setSelectionRange(1, 1);
    expect(getTextControlSelectionRect(textarea)).toBeNull();
  });

  it("有选区时返回区域并集", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = "abcdef";
    input.setSelectionRange(1, 4);
    document.body.append(input);
    stubClientRects(rectList([10, 10, 20, 20], [0, 30, 5, 40]));

    expect(getTextControlSelectionRect(input)).toEqual(rect(0, 10, 20, 40));
  });

  it("没有选区矩形时返回 null", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = "abcdef";
    input.setSelectionRange(1, 4);
    document.body.append(input);
    stubClientRects(rectList([0, 0, 0, 0]));

    expect(getTextControlSelectionRect(input)).toBeNull();
  });
});

describe("getRangeSelectionRect", () => {
  it("没有选区或折叠选区返回 null", () => {
    window.getSelection()?.removeAllRanges();
    expect(getRangeSelectionRect()).toBeNull();

    const element = document.createElement("div");
    element.textContent = "文本";
    document.body.append(element);
    const range = document.createRange();
    range.setStart(element.firstChild as Text, 1);
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(getRangeSelectionRect()).toBeNull();
  });

  it("返回选区矩形的并集", () => {
    const element = document.createElement("div");
    element.textContent = "文本内容";
    document.body.append(element);
    const range = document.createRange();
    range.setStart(element.firstChild as Text, 0);
    range.setEnd(element.firstChild as Text, 4);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    stubRangeClientRects(rectList([1, 2, 11, 12]));

    expect(getRangeSelectionRect()).toEqual(rect(1, 2, 11, 12));
  });
});

describe("getSelectionRect", () => {
  it("聚焦文本控件时走文本控件测量", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "文本";
    textarea.setSelectionRange(0, 1);
    document.body.append(textarea);
    textarea.focus();
    stubClientRects(rectList([3, 3, 8, 8]));

    expect(getSelectionRect()).toEqual(rect(3, 3, 8, 8));
  });

  it("其它情况走选区范围测量", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    window.getSelection()?.removeAllRanges();

    expect(getSelectionRect()).toBeNull();
  });
});
