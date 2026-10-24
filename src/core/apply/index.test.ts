import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../storage";
import type { ExtensionSettings, ExtensionSettingsPatch, Issue } from "../../shared/types";
import {
  applyIssueSuggestion,
  canReplaceIssue,
  convertText,
  getEditableText,
  isEditableElement,
  isSupportedInput,
  replaceSelectionInEditable,
} from "./index";

function createSettings(patch: ExtensionSettingsPatch = {}): ExtensionSettings {
  return mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW", detectionLevel: "standard", ...patch });
}

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "rule:0:2:zh-TW",
    type: "variant_term",
    subtype: "builtin-term",
    sourceText: "软件",
    targetVariant: "zh-TW",
    start: 0,
    end: 2,
    confidence: "high",
    message: "message",
    suggestions: [{ value: "軟體", label: "label", isDefault: true }],
    ruleId: "rule",
    replaceMode: "single-only",
    status: "active",
    ...overrides,
  };
}

function createContentEditable(text: string): HTMLElement {
  const element = document.createElement("div");
  element.textContent = text;
  Object.defineProperty(element, "isContentEditable", { value: true, configurable: true });
  document.body.append(element);
  return element;
}

describe("isSupportedInput", () => {
  it("text / search 输入框受支持", () => {
    const text = document.createElement("input");
    text.type = "text";
    const search = document.createElement("input");
    search.type = "search";
    expect(isSupportedInput(text)).toBe(true);
    expect(isSupportedInput(search)).toBe(true);
  });

  it("其它类型的 input 不受支持", () => {
    const email = document.createElement("input");
    email.type = "email";
    expect(isSupportedInput(email)).toBe(false);
  });

  it("非 input 元素不受支持", () => {
    expect(isSupportedInput(document.createElement("div"))).toBe(false);
  });
});

describe("isEditableElement", () => {
  it("textarea / 文本输入框 / contenteditable 可编辑", () => {
    const textarea = document.createElement("textarea");
    const input = document.createElement("input");
    input.type = "text";
    const editable = createContentEditable("你好");
    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(editable)).toBe(true);
  });

  it("普通元素与 null 不可编辑", () => {
    // jsdom 未实现 isContentEditable（返回 undefined），此处只断言非真值。
    expect(isEditableElement(document.createElement("div"))).toBeFalsy();
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(new EventTarget() as unknown as EventTarget)).toBe(false);
  });
});

describe("getEditableText", () => {
  it("表单控件返回 value", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "文本";
    expect(getEditableText(textarea)).toBe("文本");
  });

  it("contenteditable 返回 textContent", () => {
    expect(getEditableText(createContentEditable("内容"))).toBe("内容");
  });
});

describe("canReplaceIssue", () => {
  it("表单控件始终可替换", () => {
    expect(canReplaceIssue(document.createElement("textarea"))).toBe(true);
  });

  it("单一文本节点的 contenteditable 可替换", () => {
    expect(canReplaceIssue(createContentEditable("你好"))).toBe(true);
  });

  it("空 contenteditable 可替换", () => {
    expect(canReplaceIssue(createContentEditable(""))).toBe(true);
  });

  it("包含多个子节点时不可替换", () => {
    const element = document.createElement("div");
    element.append(document.createElement("span"), document.createTextNode("文本"));
    element.setAttribute("contenteditable", "true");
    expect(canReplaceIssue(element)).toBe(false);
  });

  it("唯一子节点不是文本节点时不可替换", () => {
    const element = document.createElement("div");
    element.append(document.createElement("span"));
    element.setAttribute("contenteditable", "true");
    expect(canReplaceIssue(element)).toBe(false);
  });
});

describe("applyIssueSuggestion", () => {
  it("替换 textarea 中的区间并调整光标", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "软件很好用";
    textarea.setSelectionRange(4, 4);
    const events: string[] = [];
    textarea.addEventListener("input", () => events.push("input"));
    textarea.addEventListener("change", () => events.push("change"));

    const changed = applyIssueSuggestion(textarea, createIssue(), "軟體");

    expect(changed).toBe(true);
    expect(textarea.value).toBe("軟體很好用");
    expect(textarea.selectionStart).toBe(4);
    expect(events).toEqual(["input", "change"]);
  });

  it("替换文本框中较前的区间时光标向前收缩", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = "软件和视频";
    input.setSelectionRange(5, 5);

    applyIssueSuggestion(input, createIssue({ start: 0, end: 2 }), "軟體");

    // 原区间 2 字被 2 字替换，宽高不变，光标保持在 5。
    expect(input.value).toBe("軟體和视频");
    expect(input.selectionStart).toBe(5);

    applyIssueSuggestion(
      input,
      createIssue({ id: "video", start: 3, end: 5, suggestions: [{ value: "影片", label: "", isDefault: true }] }),
      "影片",
    );
    expect(input.value).toBe("軟體和影片");
  });

  it("替换 contenteditable 的文本节点并派发事件", () => {
    const element = createContentEditable("软件很好用");
    const events: string[] = [];
    element.addEventListener("input", () => events.push("input"));

    const changed = applyIssueSuggestion(element, createIssue(), "軟體");

    expect(changed).toBe(true);
    expect(element.textContent).toBe("軟體很好用");
    expect(events).toEqual(["input"]);
  });

  it("contenteditable 结构复杂时拒绝替换", () => {
    const element = document.createElement("div");
    element.append(document.createElement("span"), document.createTextNode("文本"));
    expect(applyIssueSuggestion(element, createIssue(), "替換")).toBe(false);
  });
});

describe("replaceSelectionInEditable", () => {
  it("替换文本框选区并将光标移到替换文本之后", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "前後";
    textarea.setSelectionRange(1, 2);
    const events: string[] = [];
    textarea.addEventListener("input", () => events.push("input"));

    expect(replaceSelectionInEditable(textarea, "中")).toBe(true);
    expect(textarea.value).toBe("前中");
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);
    expect(events).toEqual(["input"]);
  });

  it("折叠光标（无选区）时返回 false", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "文本";
    textarea.setSelectionRange(1, 1);
    expect(replaceSelectionInEditable(textarea, "替換")).toBe(false);
    expect(textarea.value).toBe("文本");
  });

  it("替换 contenteditable 中的选区", () => {
    const element = createContentEditable("前後");
    const range = document.createRange();
    range.setStart(element.firstChild as Text, 1);
    range.setEnd(element.firstChild as Text, 2);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(replaceSelectionInEditable(element, "中")).toBe(true);
    expect(element.textContent).toBe("前中");
  });

  it("没有选区时返回 false", () => {
    window.getSelection()?.removeAllRanges();
    expect(replaceSelectionInEditable(createContentEditable("文本"), "替換")).toBe(false);
  });
});

describe("convertText", () => {
  it("无问题文本原样返回", () => {
    expect(convertText("hello", createSettings())).toBe("hello");
  });

  it("标准模式下同时转换词汇与字形", () => {
    expect(convertText("软件默认很好用", createSettings())).toBe("軟體預設很好用");
  });

  it("宽松模式只转换字形", () => {
    expect(convertText("软件", createSettings({ detectionLevel: "relaxed" }))).toBe("軟件");
  });

  it("反向转换到简体", () => {
    expect(convertText("軟體預設", createSettings({ defaultVariant: "zh-CN" }))).toBe("软件默认");
  });

  it("多个命中项从后往前替换，索引互不干扰", () => {
    expect(convertText("视频和出租车", createSettings())).toBe("影片和計程車");
  });
});
