import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../../shared/types";
import { state } from "../state";
import { measureIssueRects } from "../geometry/rects";
import { POPOVER_ID } from "./styles";
import {
  cancelHideSuggestionPopover,
  ensureSuggestionPopover,
  hideSuggestionPopover,
  hideSuggestionPopoverOnly,
  positionSuggestionPopover,
  renderSuggestionPopover,
  repositionSuggestionPopover,
  scheduleHideSuggestionPopover,
} from "./suggestionPopover";

vi.mock("../geometry/rects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../geometry/rects")>();
  return { ...actual, measureIssueRects: vi.fn(() => []) };
});

const measureMock = vi.mocked(measureIssueRects);

function createIssue(id = "issue-1"): Issue {
  return {
    id,
    type: "variant_term",
    subtype: "builtin-term",
    sourceText: "软件",
    targetVariant: "zh-TW",
    start: 0,
    end: 2,
    confidence: "high",
    message: "建议改为「軟體」",
    suggestions: [{ value: "軟體", label: "改用", isDefault: true }],
    ruleId: "rule",
    replaceMode: "single-only",
    status: "active",
  };
}

function createTextarea(text = "软件"): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.append(textarea);
  return textarea;
}

function createActions() {
  return { replace: vi.fn(async () => {}), allow: vi.fn(async () => {}), ignore: vi.fn(async () => {}), replaceAll: vi.fn(async () => {}) };
}

beforeEach(() => {
  state.activeIssues = [createIssue()];
  state.activeElement = createTextarea();
  state.popoverIssueId = null;
  state.issueRectMap.clear();
  state.actions = createActions();
  measureMock.mockReturnValue([
    { left: 20, top: 30, right: 60, bottom: 50, width: 40, height: 20 },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  // 浮层元素在模块内缓存，测试间保留 DOM 节点，仅重置状态。
  const popover = document.getElementById(POPOVER_ID);
  if (popover) {
    popover.dataset.hidden = "true";
    popover.innerHTML = "";
  }
  state.activeElement = null;
  state.actions = null;
});

describe("ensureSuggestionPopover", () => {
  it("只创建一个浮层", () => {
    expect(ensureSuggestionPopover()).toBe(ensureSuggestionPopover());
    expect(document.querySelectorAll(`#${POPOVER_ID}`)).toHaveLength(1);
  });
});

describe("renderSuggestionPopover", () => {
  it("渲染建议文案与操作按钮", () => {
    renderSuggestionPopover("issue-1");

    const popover = document.getElementById(POPOVER_ID)!;
    expect(popover.dataset.hidden).toBe("false");
    expect(popover.querySelector(".cvl-popover-message")?.textContent).toBe("建议改为「軟體」");
    expect(popover.querySelector(".cvl-popover-warning")).toBeNull();
    expect(state.popoverIssueId).toBe("issue-1");
  });

  it("HTML 特殊字符会被转义", () => {
    state.activeIssues = [{ ...createIssue(), message: "<img src=x>" }];
    state.popoverIssueId = "issue-1";
    state.issueRectMap.set("issue-1", [
      { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 },
    ]);

    renderSuggestionPopover("issue-1");
    expect(document.querySelector(`#${POPOVER_ID} img`)).toBeNull();
    expect(document.querySelector(".cvl-popover-message")?.textContent).toBe("<img src=x>");
  });

  it("找不到 issue 或标注位置时隐藏浮层", () => {
    renderSuggestionPopover("missing");
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("true");

    measureMock.mockReturnValue([]);
    renderSuggestionPopover("issue-1");
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("true");
  });

  it("无法替换的编辑区域禁用替换按钮并显示提示", () => {
    const complex = document.createElement("div");
    complex.append(document.createElement("span"), document.createTextNode("文本"));
    state.activeElement = complex as unknown as HTMLTextAreaElement;

    renderSuggestionPopover("issue-1");
    const popover = document.getElementById(POPOVER_ID)!;
    expect(popover.querySelector(".cvl-popover-warning")).not.toBeNull();
    expect(
      popover.querySelector<HTMLButtonElement>('[data-action="replace"]')?.disabled,
    ).toBe(true);
  });

  it("点击按钮派发对应动作", async () => {
    renderSuggestionPopover("issue-1");
    const popover = document.getElementById(POPOVER_ID)!;

    popover.querySelector<HTMLButtonElement>('[data-action="replace"]')!.click();
    popover.querySelector<HTMLButtonElement>('[data-action="allow"]')!.click();
    popover.querySelector<HTMLButtonElement>('[data-action="ignore"]')!.click();
    await Promise.resolve();

    expect(state.actions!.replace).toHaveBeenCalledWith(expect.objectContaining({ id: "issue-1" }));
    expect(state.actions!.allow).toHaveBeenCalledTimes(1);
    expect(state.actions!.ignore).toHaveBeenCalledTimes(1);
  });

  it("没有注册动作时不报错", async () => {
    state.actions = null;
    renderSuggestionPopover("issue-1");
    document
      .querySelector<HTMLButtonElement>(`#${POPOVER_ID} [data-action="replace"]`)!
      .click();
    await Promise.resolve();
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("false");
  });
});

describe("positionSuggestionPopover", () => {
  const anchor = { left: 20, top: 30, right: 60, bottom: 50, width: 40, height: 20 };

  it("默认放在标注下方并转为文档坐标", () => {
    vi.stubGlobal("scrollX", 5);
    vi.stubGlobal("scrollY", 7);
    positionSuggestionPopover(anchor, true);

    const popover = ensureSuggestionPopover();
    expect(popover.style.left).toBe("25px");
    expect(popover.style.top).toBe("61px");
    vi.unstubAllGlobals();
  });

  it("超出右边界时向左收拢", () => {
    positionSuggestionPopover({ ...anchor, left: 1020, right: 1060 }, true);
    expect(parseFloat(ensureSuggestionPopover().style.left)).toBe(1024 - 12);
  });

  it("超出下边界时翻到标注上方", () => {
    positionSuggestionPopover({ ...anchor, top: 760, bottom: 780 }, true);
    expect(parseFloat(ensureSuggestionPopover().style.top)).toBe(760 - 4);
  });

  it("位置未变化时跳过重复写入", () => {
    positionSuggestionPopover(anchor, true);
    const popover = ensureSuggestionPopover();
    popover.style.left = "999px";
    positionSuggestionPopover(anchor);
    expect(popover.style.left).toBe("999px");
  });
});

describe("隐藏调度", () => {
  it("scheduleHide 到时隐藏并清空 popoverIssueId", () => {
    vi.useFakeTimers();
    state.popoverIssueId = "issue-1";
    renderSuggestionPopover("issue-1");
    scheduleHideSuggestionPopover();

    vi.advanceTimersByTime(500);
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("true");
    expect(state.popoverIssueId).toBeNull();
  });

  it("cancelHide 取消待执行隐藏", () => {
    vi.useFakeTimers();
    renderSuggestionPopover("issue-1");
    scheduleHideSuggestionPopover();
    cancelHideSuggestionPopover();
    vi.advanceTimersByTime(500);
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("false");
  });

  it("hideSuggestionPopoverOnly 只隐藏浮层", () => {
    state.popoverIssueId = "issue-1";
    hideSuggestionPopoverOnly();
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("true");
    expect(state.popoverIssueId).toBe("issue-1");
  });
});

describe("repositionSuggestionPopover", () => {
  it("浮层隐藏时不做处理", () => {
    hideSuggestionPopover();
    repositionSuggestionPopover();
    expect(ensureSuggestionPopover().dataset.hidden).toBe("true");
  });

  it("标注不可见时隐藏浮层", () => {
    renderSuggestionPopover("issue-1");
    measureMock.mockReturnValue([]);

    repositionSuggestionPopover();
    expect(document.getElementById(POPOVER_ID)!.dataset.hidden).toBe("true");
  });

  it("重新测量后更新位置", () => {
    renderSuggestionPopover("issue-1");
    measureMock.mockReturnValue([
      { left: 300, top: 400, right: 340, bottom: 420, width: 40, height: 20 },
    ]);

    repositionSuggestionPopover();
    expect(ensureSuggestionPopover().style.left).toBe("300px");
    expect(ensureSuggestionPopover().style.top).toBe("424px");
  });
});
