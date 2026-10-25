import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../../shared/types";
import { state } from "../state";
import {
  LAUNCHER_EXPANDED_WIDTH,
  LAUNCHER_HEIGHT,
  LAUNCHER_ID,
  LAUNCHER_TOOLTIP_ID,
} from "./styles";
import {
  collapseLauncher,
  ensureCvlLauncher,
  hideLauncher,
  setLauncherBusy,
  setLauncherEditing,
  updateLauncher,
} from "./cvlLauncher";

vi.mock("./mainPanel", () => ({
  isMainPanelOpen: vi.fn(() => false),
  openReviewView: vi.fn(),
}));

vi.mock("../../shared/settingsClient", () => ({
  toggleSite: vi.fn(),
}));

vi.mock("./suggestionPopover", () => ({
  cancelHideSuggestionPopover: vi.fn(),
  scheduleHideSuggestionPopover: vi.fn(),
}));

const { isMainPanelOpen, openReviewView } = await import("./mainPanel");
const { toggleSite } = await import("../../shared/settingsClient");
const isMainPanelOpenMock = vi.mocked(isMainPanelOpen);

function createIssue(id: string): Issue {
  return {
    id,
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
  };
}

function createTextarea(value = "软件很好用"): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 300, bottom: 160, width: 200, height: 60 }) as DOMRect;
  document.body.append(textarea);
  return textarea;
}

function getStatusButton(): HTMLButtonElement {
  return ensureCvlLauncher().querySelector<HTMLButtonElement>(
    '.cvl-launcher-button[data-role="status"]',
  )!;
}

beforeEach(() => {
  vi.stubGlobal("browser", { runtime: { getURL: () => "icon.svg" } });
  state.activeElement = createTextarea();
  state.activeIssues = [createIssue("issue-1")];
  const launcher = ensureCvlLauncher();
  launcher.dataset.hidden = "true";
  launcher.dataset.expanded = "false";
});

afterEach(() => {
  // 先复位内部状态（会触发 updateLauncher），再清理全局 mock。
  setLauncherBusy(false);
  setLauncherEditing(false);
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  state.activeElement = null;
  state.activeIssues = [];
});

describe("updateLauncher 可见性", () => {
  it("没有编辑目标时隐藏", () => {
    state.activeElement = null;
    updateLauncher();
    expect(ensureCvlLauncher().dataset.hidden).toBe("true");
  });

  it("文本为空时不展示", () => {
    state.activeElement = createTextarea("   ");
    updateLauncher();
    expect(ensureCvlLauncher().dataset.hidden).toBe("true");
  });

  it("不含中文字符时不展示", () => {
    state.activeElement = createTextarea("hello world");
    updateLauncher();
    expect(ensureCvlLauncher().dataset.hidden).toBe("true");
  });

  it("主面板打开时隐藏", () => {
    isMainPanelOpenMock.mockReturnValue(true);
    updateLauncher();
    expect(ensureCvlLauncher().dataset.hidden).toBe("true");
  });
});

describe("updateLauncher 状态与位置", () => {
  it("展示错误数量并定位到文本框右下角", () => {
    updateLauncher();
    const launcher = ensureCvlLauncher();

    expect(launcher.dataset.hidden).toBe("false");
    expect(launcher.dataset.state).toBe("error");
    expect(launcher.querySelectorAll(".cvl-launcher-button")).toHaveLength(3);
    expect(
      launcher.querySelector<HTMLElement>(".cvl-status-layer--count")?.textContent,
    ).toBe("1");
    expect(getStatusButton().dataset.tooltip).toContain("1");
    expect(launcher.style.left).toBe(`${100 + 200 - 8 - LAUNCHER_EXPANDED_WIDTH}px`);
    expect(launcher.style.top).toBe(`${100 + 60 - 8 - LAUNCHER_HEIGHT}px`);
    expect(launcher.style.getPropertyValue("--cvl-status-icon")).toContain("data:image/svg+xml");
  });

  it("无问题时显示成功态", () => {
    state.activeIssues = [];
    updateLauncher();
    expect(ensureCvlLauncher().dataset.state).toBe("success");
    expect(
      ensureCvlLauncher().querySelector<HTMLElement>(".cvl-status-layer--count")?.textContent,
    ).toBe("0");
  });

  it("问题超过 99 个时显示 99+", () => {
    state.activeIssues = Array.from({ length: 120 }, (_, index) => createIssue(`issue-${index}`));
    updateLauncher();
    expect(
      ensureCvlLauncher().querySelector<HTMLElement>(".cvl-status-layer--count")?.textContent,
    ).toBe("99+");
  });

  it("忙碌态优先于错误态", () => {
    setLauncherBusy(true);
    expect(ensureCvlLauncher().dataset.state).toBe("busy");
    expect(getStatusButton().dataset.tooltip).toContain("检查");
  });

  it("编辑态显示为圆点且不响应悬停展开", () => {
    setLauncherEditing(true);
    const launcher = ensureCvlLauncher();
    expect(launcher.dataset.state).toBe("editing");

    launcher.dispatchEvent(new Event("mouseenter"));
    expect(launcher.dataset.expanded).toBe("false");
  });

  it("文本框没有可见尺寸时隐藏", () => {
    state.activeElement!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;
    updateLauncher();
    expect(ensureCvlLauncher().dataset.hidden).toBe("true");
  });
});

describe("启动器交互", () => {
  beforeEach(() => {
    updateLauncher();
  });

  it("悬停展开、离开收起", () => {
    const launcher = ensureCvlLauncher();
    launcher.dispatchEvent(new Event("mouseenter"));
    expect(launcher.dataset.expanded).toBe("true");

    launcher.dispatchEvent(new Event("mouseleave"));
    expect(launcher.dataset.expanded).toBe("false");
  });

  it("聚焦展开，焦点移出后收起", () => {
    const launcher = ensureCvlLauncher();
    launcher.dispatchEvent(new FocusEvent("focusin"));
    expect(launcher.dataset.expanded).toBe("true");

    launcher.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null }));
    expect(launcher.dataset.expanded).toBe("false");
  });

  it("点击状态按钮打开评审面板", () => {
    getStatusButton().click();
    expect(openReviewView).toHaveBeenCalled();
  });

  it("点击反馈按钮打开项目主页", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    ensureCvlLauncher()
      .querySelector<HTMLButtonElement>('[data-role="feedback"]')!
      .click();

    expect(open).toHaveBeenCalledWith(
      "https://github.com/amlzq/chinese-variants-linter/issues",
      "_blank",
      "noopener",
    );
  });

  it("点击禁用按钮关闭当前站点", () => {
    ensureCvlLauncher()
      .querySelector<HTMLButtonElement>('[data-role="disable"]')!
      .click();

    expect(toggleSite).toHaveBeenCalledWith(location.hostname, false);
  });

  it("悬停在操作按钮上显示提示气泡，移出后隐藏", () => {
    const launcher = ensureCvlLauncher();
    const disable = launcher.querySelector<HTMLButtonElement>('[data-role="disable"]')!;

    launcher.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: launcher }));
    disable.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

    const tooltip = document.getElementById(LAUNCHER_TOOLTIP_ID)!;
    expect(tooltip.dataset.hidden).toBe("false");
    expect(tooltip.dataset.visible).toBe("true");
    expect(tooltip.querySelector(".cvl-launcher-tooltip-body")?.textContent).toBe(
      disable.dataset.tooltip,
    );

    launcher.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: null }));
    expect(tooltip.dataset.hidden).toBe("true");
  });

  it("hideLauncher 隐藏并收起启动器", () => {
    hideLauncher();
    expect(ensureCvlLauncher().dataset.hidden).toBe("true");
    expect(ensureCvlLauncher().dataset.expanded).toBe("false");
  });

  it("collapseLauncher 收起启动器", () => {
    ensureCvlLauncher().dataset.expanded = "true";
    collapseLauncher();
    expect(ensureCvlLauncher().dataset.expanded).toBe("false");
  });
});

describe("启动器单例", () => {
  it("只创建一个启动器元素", () => {
    expect(ensureCvlLauncher()).toBe(ensureCvlLauncher());
    expect(document.querySelectorAll(`#${LAUNCHER_ID}`)).toHaveLength(1);
  });
});
