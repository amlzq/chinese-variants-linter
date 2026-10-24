import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "../state";
import { MAIN_PANEL_ID } from "./styles";
import {
  ensureMainPanel,
  getMainPanelView,
  hideMainPanel,
  isMainPanelOpen,
  openReviewView,
  openSettings,
  showMainPanel,
  showReviewView,
  toggleReviewView,
} from "./mainPanel";

vi.mock("./cvlLauncher", () => {
  const launcher = document.createElement("div");
  launcher.dataset.hidden = "true";
  return {
    ensureCvlLauncher: () => launcher,
    hideLauncher: vi.fn(),
    updateLauncher: vi.fn(),
  };
});

vi.mock("./markLayer", () => ({
  clearIssueMarks: vi.fn(),
  renderMarks: vi.fn(),
  updateActiveMarkState: vi.fn(),
}));

vi.mock("./reviewView", () => {
  const view = document.createElement("div");
  return {
    ensureReviewView: () => view,
    isReviewViewOpen: vi.fn(() => true),
    renderReviewInto: vi.fn(),
    resetReviewIndex: vi.fn(),
  };
});

vi.mock("./settingsView", () => {
  const view = document.createElement("div");
  return {
    ensureSettingsView: () => view,
    hideSettingsView: vi.fn(),
    showSettingsView: vi.fn(async () => {}),
  };
});

vi.mock("./suggestionPopover", () => ({
  hideSuggestionPopover: vi.fn(),
}));

const { ensureCvlLauncher, hideLauncher, updateLauncher } = await import("./cvlLauncher");
const { clearIssueMarks, renderMarks, updateActiveMarkState } = await import("./markLayer");
const { isReviewViewOpen, renderReviewInto, resetReviewIndex } = await import("./reviewView");
const { hideSettingsView, showSettingsView } = await import("./settingsView");
const { hideSuggestionPopover } = await import("./suggestionPopover");

const isReviewViewOpenMock = vi.mocked(isReviewViewOpen);

const zeroRect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

beforeEach(() => {
  state.activeElement = document.createElement("textarea");
  state.activeIssues = [];
  state.popoverIssueId = null;
  ensureCvlLauncher().dataset.hidden = "true";
  ensureCvlLauncher().getBoundingClientRect = () => zeroRect as DOMRect;
});

afterEach(() => {
  hideMainPanel();
  vi.resetAllMocks();
  state.activeElement = null;
  state.activeIssues = [];
});

describe("ensureMainPanel", () => {
  it("只创建一个主面板并挂载两个视图", () => {
    const panel = ensureMainPanel();
    expect(panel).toBe(ensureMainPanel());
    expect(panel.id).toBe(MAIN_PANEL_ID);
    expect(panel.dataset.hidden).toBe("true");
    expect(panel.children).toHaveLength(2);
  });
});

describe("showMainPanel / hideMainPanel", () => {
  it("打开评审视图并定位到左上角（无启动器时）", () => {
    showMainPanel("review");
    const panel = ensureMainPanel();

    expect(panel.dataset.hidden).toBe("false");
    expect(isMainPanelOpen()).toBe(true);
    expect(getMainPanelView()).toBe("review");
    expect(panel.style.left).toBe("12px");
    expect(panel.style.top).toBe("12px");
    expect(hideLauncher).toHaveBeenCalled();
    expect(hideSuggestionPopover).toHaveBeenCalled();
  });

  it("启动器可见时面板定位在其左上方并受视口约束", () => {
    const launcher = ensureCvlLauncher();
    launcher.dataset.hidden = "false";
    launcher.getBoundingClientRect = () =>
      ({ left: 900, top: 700, width: 108, height: 34, right: 1008, bottom: 734 }) as DOMRect;

    showMainPanel("review");
    const panel = ensureMainPanel();
    expect(panel.style.left).toBe("432px");
    expect(panel.style.top).toBe("92px");
  });

  it("切换视图时保留当前位置", () => {
    showMainPanel("review");
    const panel = ensureMainPanel();
    panel.style.left = "200px";
    panel.style.top = "150px";

    showMainPanel("settings");
    expect(panel.dataset.view).toBe("settings");
    expect(panel.style.left).toBe("200px");
    expect(panel.style.top).toBe("150px");
  });

  it("关闭面板时重置当前 issue 并恢复启动器", () => {
    showMainPanel("review");
    state.popoverIssueId = "issue-1";
    hideMainPanel();

    expect(ensureMainPanel().dataset.hidden).toBe("true");
    expect(state.popoverIssueId).toBeNull();
    expect(updateActiveMarkState).toHaveBeenCalled();
    expect(updateLauncher).toHaveBeenCalled();
  });

  it("从设置视图关闭时隐藏设置视图", () => {
    openSettings();
    hideMainPanel();
    expect(hideSettingsView).toHaveBeenCalled();
  });
});

describe("openSettings / showReviewView", () => {
  it("打开设置视图时清理正文标注并加载设置", () => {
    openSettings();
    const panel = ensureMainPanel();

    expect(panel.dataset.hidden).toBe("false");
    expect(panel.dataset.view).toBe("settings");
    expect(clearIssueMarks).toHaveBeenCalled();
    expect(showSettingsView).toHaveBeenCalled();
  });

  it("返回评审视图时重新渲染", () => {
    openSettings();
    showReviewView();

    expect(ensureMainPanel().dataset.view).toBe("review");
    expect(hideSettingsView).toHaveBeenCalled();
    expect(renderReviewInto).toHaveBeenCalled();
    expect(renderMarks).toHaveBeenCalled();
  });
});

describe("openReviewView / toggleReviewView", () => {
  it("打开评审视图时重置索引", () => {
    openReviewView();
    expect(resetReviewIndex).toHaveBeenCalled();
    expect(ensureMainPanel().dataset.hidden).toBe("false");
  });

  it("没有可编辑内容时不打开评审", () => {
    state.activeElement = null;
    toggleReviewView();
    expect(ensureMainPanel().dataset.hidden).toBe("true");
  });

  it("没有检测结果时不打开评审", () => {
    state.activeIssues = [];
    isReviewViewOpenMock.mockReturnValue(false);
    toggleReviewView();
    expect(ensureMainPanel().dataset.hidden).toBe("true");
  });

  it("评审已打开时切换为关闭", () => {
    showMainPanel("review");
    isReviewViewOpenMock.mockReturnValue(true);
    toggleReviewView();
    expect(ensureMainPanel().dataset.hidden).toBe("true");
  });

  it("有检测结果时打开评审", () => {
    isReviewViewOpenMock.mockReturnValue(false);
    state.activeIssues = [
      {
        id: "issue-1",
        type: "script",
        subtype: "safe-char",
        sourceText: "软",
        targetVariant: "zh-TW",
        start: 0,
        end: 1,
        confidence: "high",
        message: "message",
        suggestions: [{ value: "軟", label: "label", isDefault: true }],
        ruleId: "rule",
        replaceMode: "single-only",
        status: "active",
      },
    ];

    toggleReviewView();
    expect(ensureMainPanel().dataset.hidden).toBe("false");
  });
});

describe("面板拖拽", () => {
  function dispatchPointer(
    type: "pointerdown" | "pointermove" | "pointerup",
    target: EventTarget,
    clientX: number,
    clientY: number,
  ): void {
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, clientX, clientY }) as unknown as PointerEvent,
    );
  }

  it("拖动标题栏移动面板并限制在视口内", () => {
    showMainPanel("review");
    const panel = ensureMainPanel();
    const header = document.createElement("div");
    header.className = "cvl-review-header";
    panel.append(header);

    dispatchPointer("pointerdown", header, 200, 150);
    expect(header.getAttribute("data-dragging")).toBe("true");

    dispatchPointer("pointermove", document, 300, 250);
    expect(panel.style.left).toBe("100px");
    expect(panel.style.top).toBe("100px");

    dispatchPointer("pointerup", document, 300, 250);
    expect(header.hasAttribute("data-dragging")).toBe(false);

    dispatchPointer("pointermove", document, 400, 350);
    expect(panel.style.left).toBe("100px");
  });

  it("从按钮上按下不触发拖拽", () => {
    showMainPanel("review");
    const panel = ensureMainPanel();
    const header = document.createElement("div");
    header.className = "cvl-review-header";
    const button = document.createElement("button");
    header.append(button);
    panel.append(header);

    dispatchPointer("pointerdown", button, 200, 150);
    expect(header.hasAttribute("data-dragging")).toBe(false);
  });

  it("非标题栏区域不触发拖拽", () => {
    showMainPanel("review");
    const panel = ensureMainPanel();
    const body = document.createElement("div");
    panel.append(body);

    dispatchPointer("pointerdown", body, 100, 100);
    expect(panel.querySelector("[data-dragging]")).toBeNull();
  });
});
