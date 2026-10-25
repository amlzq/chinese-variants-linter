import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Issue } from "../../shared/types";
import { t } from "../../shared/locale";
import { state } from "../state";
import { getSelectionOffsets } from "../geometry/rects";
import { REVIEW_VIEW_ID } from "./styles";
import {
  acceptAndAdvance,
  ensureReviewView,
  goToIssue,
  isReviewViewOpen,
  renderReviewInto,
  renderReviewViewIfOpen,
  resetReviewIndex,
  syncReviewToCaret,
} from "./reviewView";

vi.mock("./mainPanel", () => {
  const panel = document.createElement("div");
  return {
    ensureMainPanel: () => panel,
    getMainPanelView: vi.fn(() => "review"),
    isMainPanelOpen: vi.fn(() => true),
    hideReviewView: vi.fn(),
    openSettings: vi.fn(),
    showMainPanel: vi.fn(),
  };
});

vi.mock("./markLayer", () => ({
  updateActiveMarkState: vi.fn(),
}));

vi.mock("./tooltip", () => ({
  attachTooltip: vi.fn(),
  hideTooltip: vi.fn(),
}));

vi.mock("../geometry/rects", () => ({
  getSelectionOffsets: vi.fn(() => null),
  measureIssueRects: vi.fn(() => []),
}));

const { ensureMainPanel, getMainPanelView, hideReviewView, isMainPanelOpen, openSettings, showMainPanel } =
  await import("./mainPanel");
const { updateActiveMarkState } = await import("./markLayer");
const { hideTooltip, attachTooltip } = await import("./tooltip");

const isMainPanelOpenMock = vi.mocked(isMainPanelOpen);
const getMainPanelViewMock = vi.mocked(getMainPanelView);
const offsetsMock = vi.mocked(getSelectionOffsets);

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    type: "variant_term",
    subtype: "builtin-term",
    sourceText: "软件",
    targetVariant: "zh-TW",
    start: 5,
    end: 7,
    confidence: "high",
    message: "建议改为「軟體」",
    suggestions: [{ value: "軟體", label: "改用", isDefault: true }],
    ruleId: "rule",
    replaceMode: "single-only",
    status: "active",
    ...overrides,
  };
}

function createTextarea(value = "前面文字，软件后面文字。"): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  return textarea;
}

function createActions() {
  return {
    replace: vi.fn(async () => {}),
    allow: vi.fn(async () => {}),
    ignore: vi.fn(async () => {}),
  };
}

function view(): HTMLDivElement {
  return ensureReviewView();
}

beforeEach(() => {
  vi.stubGlobal("browser", { runtime: { getURL: () => "icon.svg" } });
  state.activeElement = createTextarea();
  state.activeIssues = [createIssue()];
  state.popoverIssueId = null;
  state.actions = createActions();
  isMainPanelOpenMock.mockReturnValue(true);
  getMainPanelViewMock.mockReturnValue("review");
  offsetsMock.mockReturnValue(null);
  resetReviewIndex();
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  state.activeElement = null;
  state.activeIssues = [];
  state.actions = null;
  state.popoverIssueId = null;
});

describe("renderReviewInto", () => {
  it("没有问题项时展示空状态", () => {
    state.activeIssues = [];
    renderReviewInto(view());

    expect(hideTooltip).toHaveBeenCalledWith(true);
    expect(view().querySelector(".cvl-review-empty-title")?.textContent).toBe(t("review.empty.title"));
    expect(view().querySelector(".cvl-review-count")).toBeNull();
    expect(view().querySelector<HTMLImageElement>(".cvl-review-logo")?.src).toContain(
      "data:image/svg+xml",
    );
  });

  it("渲染问题分类、上下文与计数", () => {
    renderReviewInto(view());

    expect(view().querySelector(".cvl-review-count")?.textContent).toBe("1");
    expect(view().querySelector(".cvl-review-card-category")?.textContent).toBe(
      t("review.category.term"),
    );
    expect(view().querySelector(".cvl-review-ctx-source")?.textContent).toBe("软件");
    expect(view().querySelector(".cvl-review-ctx-target")?.textContent).toBe("軟體");
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 1");
    expect(view().querySelector("[data-role='settings']")).not.toBeNull();
    expect(attachTooltip).toHaveBeenCalled();
    expect(state.popoverIssueId).toBe("issue-1");
    expect(updateActiveMarkState).toHaveBeenCalled();
  });

  it("字形问题显示为字形分类", () => {
    state.activeIssues = [createIssue({ type: "script", subtype: "safe-char", sourceText: "软" })];
    state.activeElement = createTextarea("软");
    renderReviewInto(view());
    expect(view().querySelector(".cvl-review-card-category")?.textContent).toBe(
      t("review.category.script"),
    );
  });

  it("上下文特殊字符会被转义", () => {
    state.activeElement = createTextarea("<b>软件</b>");
    state.activeIssues = [createIssue({ start: 3, end: 5 })];
    renderReviewInto(view());

    expect(view().querySelector(".cvl-review-card-context b")).toBeNull();
    expect(view().querySelector(".cvl-review-ctx-source")?.textContent).toBe("软件");
  });

  it("上下文包含前后省略号", () => {
    state.activeElement = createTextarea(`${"前".repeat(100)}软件${"后".repeat(100)}`);
    state.activeIssues = [createIssue({ start: 100, end: 102 })];
    renderReviewInto(view());

    expect(view().querySelectorAll(".cvl-review-ctx-ellipsis")).toHaveLength(2);
  });

  it("无法替换的编辑区域禁用接受按钮", () => {
    const complex = document.createElement("div");
    complex.append(document.createElement("span"), document.createTextNode("文本"));
    state.activeElement = complex as unknown as HTMLTextAreaElement;

    renderReviewInto(view());
    expect(view().querySelector<HTMLButtonElement>("[data-action='replace']")?.disabled).toBe(true);
  });

  it("多个问题时启用前后翻页", () => {
    state.activeIssues = [createIssue(), createIssue({ id: "issue-2", start: 8, end: 9 })];
    renderReviewInto(view());

    expect(view().querySelector<HTMLButtonElement>("[data-role='prev']")?.disabled).toBe(false);
    expect(view().querySelector<HTMLButtonElement>("[data-role='next']")?.disabled).toBe(false);
  });

  it("索引越界时回到第一项", () => {
    state.activeIssues = [createIssue(), createIssue({ id: "issue-2", start: 8, end: 9 })];
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();

    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 2");
    expect(view().querySelector(".cvl-review-card")?.getAttribute("data-issue-id")).toBe(
      "issue-1",
    );
  });
});

describe("头部与卡片交互", () => {
  it("关闭与设置按钮分别派发动作", () => {
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-role='close']")!.click();
    view().querySelector<HTMLButtonElement>("[data-role='settings']")!.click();

    expect(hideReviewView).toHaveBeenCalled();
    expect(openSettings).toHaveBeenCalled();
  });

  it("点击操作按钮调用对应动作", async () => {
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-action='replace']")!.click();
    view().querySelector<HTMLButtonElement>("[data-action='ignore']")!.click();
    view().querySelector<HTMLButtonElement>("[data-action='allow']")!.click();
    await Promise.resolve();

    expect(state.actions!.replace).toHaveBeenCalledWith(expect.objectContaining({ id: "issue-1" }));
    expect(state.actions!.ignore).toHaveBeenCalledWith(expect.objectContaining({ id: "issue-1" }));
    expect(state.actions!.allow).toHaveBeenCalledWith(expect.objectContaining({ id: "issue-1" }));
  });

  it("动作未注册时点击不报错", async () => {
    state.actions = null;
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-action='replace']")!.click();
    await Promise.resolve();
    expect(view().querySelector(".cvl-review-card")).not.toBeNull();
  });

  it("前一项 / 后一项循环切换", () => {
    state.activeIssues = [createIssue(), createIssue({ id: "issue-2", start: 8, end: 9 })];
    renderReviewInto(view());

    view().querySelector<HTMLButtonElement>("[data-role='prev']")!.click();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("2 / 2");
    expect(state.popoverIssueId).toBe("issue-2");

    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 2");
    expect(state.popoverIssueId).toBe("issue-1");
  });
});

describe("isReviewViewOpen", () => {
  it("面板打开且当前为评审视图时为 true", () => {
    expect(isReviewViewOpen()).toBe(true);

    isMainPanelOpenMock.mockReturnValue(false);
    expect(isReviewViewOpen()).toBe(false);
  });

  it("面板处于设置视图时为 false", () => {
    getMainPanelViewMock.mockReturnValue("settings");
    expect(isReviewViewOpen()).toBe(false);
  });
});

describe("renderReviewViewIfOpen", () => {
  it("未打开时不渲染", () => {
    isMainPanelOpenMock.mockReturnValue(false);
    const before = view().innerHTML;
    renderReviewViewIfOpen();
    expect(view().innerHTML).toBe(before);
  });

  it("索引超出范围时回到第一项并渲染", () => {
    state.activeIssues = Array.from({ length: 3 }, (_, index) =>
      createIssue({ id: `issue-${index}`, start: index }),
    );
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();

    state.activeIssues = [createIssue()];
    renderReviewViewIfOpen();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 1");
  });
});

describe("syncReviewToCaret", () => {
  it("面板未打开、无编辑目标或无问题时不处理", () => {
    isMainPanelOpenMock.mockReturnValue(false);
    syncReviewToCaret();
    expect(offsetsMock).not.toHaveBeenCalled();

    isMainPanelOpenMock.mockReturnValue(true);
    state.activeElement = null;
    syncReviewToCaret();
    expect(offsetsMock).not.toHaveBeenCalled();

    state.activeElement = createTextarea();
    state.activeIssues = [];
    syncReviewToCaret();
    expect(offsetsMock).not.toHaveBeenCalled();
  });

  it("取不到选区时不处理", () => {
    offsetsMock.mockReturnValue(null);
    syncReviewToCaret();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 1");
  });

  it("光标位置命中另一条问题时切换", () => {
    state.activeIssues = [
      createIssue({ start: 0, end: 2 }),
      createIssue({ id: "issue-2", start: 10, end: 12 }),
    ];
    renderReviewInto(view());
    offsetsMock.mockReturnValue({ start: 10, end: 12 });

    syncReviewToCaret();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("2 / 2");
    expect(state.popoverIssueId).toBe("issue-2");
  });

  it("已处于当前问题时不重复渲染", () => {
    renderReviewInto(view());
    const renderSpy = vi.fn();
    state.actions = { ...createActions(), replace: renderSpy };
    offsetsMock.mockReturnValue({ start: 5, end: 5 });

    const before = view().innerHTML;
    syncReviewToCaret();
    expect(view().innerHTML).toBe(before);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it("未命中任何问题时保持当前页", () => {
    renderReviewInto(view());
    offsetsMock.mockReturnValue({ start: 0, end: 0 });
    syncReviewToCaret();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 1");
  });
});

describe("resetReviewIndex / goToIssue", () => {
  it("resetReviewIndex 回到第一项", () => {
    state.activeIssues = [createIssue(), createIssue({ id: "issue-2", start: 8, end: 9 })];
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();

    resetReviewIndex();
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 2");
  });

  it("goToIssue 对未知 id 不做处理", () => {
    const before = view().innerHTML;
    goToIssue("missing");
    expect(view().innerHTML).toBe(before);
    expect(showMainPanel).not.toHaveBeenCalled();
  });

  it("面板隐藏时打开评审视图并定位", () => {
    state.activeIssues = [createIssue(), createIssue({ id: "issue-2", start: 8, end: 9 })];
    state.activeElement = createTextarea("软件");
    isMainPanelOpenMock.mockReturnValue(false);
    ensureMainPanel().dataset.hidden = "true";

    goToIssue("issue-2");
    expect(showMainPanel).toHaveBeenCalledWith("review");
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("2 / 2");
  });
});

describe("acceptAndAdvance", () => {
  it("面板未打开或动作未注册时不处理", async () => {
    isMainPanelOpenMock.mockReturnValue(false);
    await acceptAndAdvance();
    expect(state.actions!.replace).not.toHaveBeenCalled();

    isMainPanelOpenMock.mockReturnValue(true);
    state.actions = null;
    await acceptAndAdvance();
    expect(ensureMainPanel()).not.toBeNull();
  });

  it("替换当前项并移除后，同一索引指向下一项", async () => {
    state.activeIssues = [
      createIssue(),
      createIssue({ id: "issue-2", start: 8, end: 9 }),
      createIssue({ id: "issue-3", start: 10, end: 11 }),
    ];
    renderReviewInto(view());
    const replace = vi.fn(async (issue: Issue) => {
      state.activeIssues = state.activeIssues.filter((item) => item.id !== issue.id);
    });
    state.actions = { ...createActions(), replace };

    await acceptAndAdvance();

    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ id: "issue-1" }));
    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 2");
    expect(view().querySelector(".cvl-review-card")?.getAttribute("data-issue-id")).toBe(
      "issue-2",
    );
  });

  it("移除最后一项后索引收敛到新的末项", async () => {
    state.activeIssues = [
      createIssue(),
      createIssue({ id: "issue-2", start: 8, end: 9 }),
      createIssue({ id: "issue-3", start: 10, end: 11 }),
    ];
    renderReviewInto(view());
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();
    view().querySelector<HTMLButtonElement>("[data-role='next']")!.click();

    state.actions!.replace = vi.fn(async () => {
      state.activeIssues = state.activeIssues.slice(0, 1);
    });
    await acceptAndAdvance();

    expect(view().querySelector(".cvl-review-counter")?.textContent).toBe("1 / 1");
  });

  it("问题全部解决后渲染空状态", async () => {
    renderReviewInto(view());
    state.actions!.replace = vi.fn(async () => {
      state.activeIssues = [];
    });

    await acceptAndAdvance();
    expect(view().querySelector(".cvl-review-empty-title")).not.toBeNull();
  });
});
