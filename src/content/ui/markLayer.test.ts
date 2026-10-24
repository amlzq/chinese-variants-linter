import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../../shared/types";
import { measureIssueRects } from "../geometry/rects";
import { state } from "../state";
import { POPOVER_ID } from "./styles";
import {
  clearIssueMarks,
  ensureMarkLayer,
  renderMarks,
  updateActiveMarkState,
} from "./markLayer";

vi.mock("../geometry/rects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../geometry/rects")>();
  return { ...actual, measureIssueRects: vi.fn(() => []) };
});

vi.mock("./reviewView", () => ({
  goToIssue: vi.fn(),
  isReviewViewOpen: vi.fn(() => false),
}));

vi.mock("./settingsView", () => ({
  isSettingsViewOpen: vi.fn(() => false),
}));

vi.mock("./cvlLauncher", () => ({
  updateLauncher: vi.fn(),
}));

const { goToIssue, isReviewViewOpen } = await import("./reviewView");
const { isSettingsViewOpen } = await import("./settingsView");
const { updateLauncher } = await import("./cvlLauncher");
const measureMock = vi.mocked(measureIssueRects);
const isReviewViewOpenMock = vi.mocked(isReviewViewOpen);
const isSettingsViewOpenMock = vi.mocked(isSettingsViewOpen);

function createIssue(id = "issue-1", start = 0): Issue {
  return {
    id,
    type: "script",
    subtype: "safe-char",
    sourceText: "软",
    targetVariant: "zh-TW",
    start,
    end: start + 1,
    confidence: "high",
    message: "建议改为「軟」",
    suggestions: [{ value: "軟", label: "改用", isDefault: true }],
    ruleId: "rule",
    replaceMode: "single-only",
    status: "active",
  };
}

function createTextarea(): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = "软件";
  document.body.append(textarea);
  return textarea;
}

beforeEach(() => {
  state.activeElement = createTextarea();
  state.activeIssues = [createIssue()];
  state.popoverIssueId = null;
  state.issueRectMap.clear();
  measureMock.mockReturnValue([
    { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
  ]);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  state.activeElement = null;
  state.activeIssues = [];
  state.popoverIssueId = null;
  state.issueRectMap.clear();
  clearIssueMarks();
});

describe("ensureMarkLayer", () => {
  it("只创建一个标注层", () => {
    expect(ensureMarkLayer()).toBe(ensureMarkLayer());
    expect(document.querySelectorAll("#cvl-mark-layer")).toHaveLength(1);
  });
});

describe("renderMarks", () => {
  it("为每个标注矩形渲染下划线", () => {
    vi.stubGlobal("scrollX", 5);
    vi.stubGlobal("scrollY", 7);

    renderMarks();
    const layer = ensureMarkLayer();
    const mark = layer.querySelector<HTMLButtonElement>(".cvl-mark")!;

    expect(layer.dataset.hidden).toBe("false");
    expect(mark.dataset.issueId).toBe("issue-1");
    expect(mark.dataset.confidence).toBe("high");
    expect(mark.style.left).toBe("15px");
    expect(mark.style.top).toBe(`${Math.max(40 - 4, 20) + 7}px`);
    expect(mark.getAttribute("aria-label")).toBe("建议改为「軟」");
    expect(state.issueRectMap.get("issue-1")).toHaveLength(1);
    expect(updateLauncher).toHaveBeenCalled();
  });

  it("没有可编辑元素时隐藏标注层", () => {
    state.activeElement = null;
    renderMarks();
    expect(ensureMarkLayer().dataset.hidden).toBe("true");
    expect(updateLauncher).toHaveBeenCalled();
  });

  it("没有问题时隐藏标注层", () => {
    state.activeIssues = [];
    renderMarks();
    expect(ensureMarkLayer().dataset.hidden).toBe("true");
  });

  it("测量不到位置时隐藏标注层", () => {
    measureMock.mockReturnValue([]);
    renderMarks();
    expect(ensureMarkLayer().dataset.hidden).toBe("true");
    expect(state.issueRectMap.size).toBe(0);
  });

  it("设置视图打开时清空标注", () => {
    isSettingsViewOpenMock.mockReturnValue(true);
    renderMarks();
    expect(ensureMarkLayer().innerHTML).toBe("");
    expect(ensureMarkLayer().dataset.hidden).toBe("true");
  });

  it("点击下划线跳转到对应 issue", () => {
    renderMarks();
    ensureMarkLayer().querySelector<HTMLButtonElement>(".cvl-mark")!.click();
    expect(goToIssue).toHaveBeenCalledWith("issue-1");
  });

  it("悬停时展示建议浮层，评审视图打开时不展示", () => {
    renderMarks();
    const mark = ensureMarkLayer().querySelector<HTMLButtonElement>(".cvl-mark")!;

    mark.dispatchEvent(new Event("mouseenter"));
    expect(document.getElementById(POPOVER_ID)?.dataset.hidden).toBe("false");

    hidePopoverForTest();
    isReviewViewOpenMock.mockReturnValue(true);
    mark.dispatchEvent(new Event("mouseenter"));
    expect(document.getElementById(POPOVER_ID)?.dataset.hidden).toBe("true");
  });

  it("已打开的浮层在重绘后保持展示", () => {
    renderMarks();
    state.popoverIssueId = "issue-1";
    renderMarks();
    expect(document.getElementById(POPOVER_ID)?.dataset.hidden).toBe("false");
    expect(
      ensureMarkLayer().querySelector<HTMLButtonElement>(".cvl-mark")!.dataset.active,
    ).toBe("true");
  });

  it("当前 issue 不在新标注中时隐藏浮层", () => {
    renderMarks();
    state.popoverIssueId = "issue-1";
    measureMock.mockReturnValue([]);
    renderMarks();
    expect(document.getElementById(POPOVER_ID)?.dataset.hidden).toBe("true");
  });
});

describe("updateActiveMarkState", () => {
  it("标记当前 issue 并绘制背景高亮", () => {
    vi.stubGlobal("scrollX", 0);
    vi.stubGlobal("scrollY", 0);
    renderMarks();
    state.popoverIssueId = "issue-1";

    updateActiveMarkState();

    const layer = ensureMarkLayer();
    expect(layer.querySelector<HTMLElement>(".cvl-mark")!.dataset.active).toBe("true");
    const highlight = layer.querySelector<HTMLElement>(".cvl-mark-highlight")!;
    expect(highlight.dataset.confidence).toBe("high");
    expect(highlight.style.left).toBe("8px");
    expect(highlight.style.top).toBe("21px");
    expect(highlight.style.width).toBe("24px");
    expect(highlight.style.height).toBe("17px");
  });

  it("重复调用不会堆叠高亮", () => {
    renderMarks();
    state.popoverIssueId = "issue-1";
    updateActiveMarkState();
    updateActiveMarkState();
    expect(ensureMarkLayer().querySelectorAll(".cvl-mark-highlight")).toHaveLength(1);
  });

  it("没有当前 issue 时只重置激活态", () => {
    renderMarks();
    updateActiveMarkState();
    expect(ensureMarkLayer().querySelector(".cvl-mark-highlight")).toBeNull();
  });
});

describe("clearIssueMarks", () => {
  it("清空标注、隐藏图层并重置状态", () => {
    renderMarks();
    state.popoverIssueId = "issue-1";
    clearIssueMarks();

    expect(ensureMarkLayer().innerHTML).toBe("");
    expect(ensureMarkLayer().dataset.hidden).toBe("true");
    expect(state.issueRectMap.size).toBe(0);
    expect(state.popoverIssueId).toBeNull();
  });
});

function hidePopoverForTest(): void {
  const popover = document.getElementById(POPOVER_ID);
  if (popover) {
    popover.dataset.hidden = "true";
  }
}
