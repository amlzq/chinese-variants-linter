import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, STORAGE_KEY } from "../src/core/storage";
import { state } from "../src/content/state";
import { ACTIVE_CLASS } from "../src/content/ui/styles";
import { ensureCvlLauncher, hideLauncher } from "../src/content/ui/cvlLauncher";
import {
  ensureMainPanel,
  getMainPanelView,
  hideMainPanel,
  isMainPanelOpen,
} from "../src/content/ui/mainPanel";
import {
  ensureSelectionToolbar,
  hideSelectionToolbar,
} from "../src/content/ui/selectionToolbar";
import { getSelectionRect } from "../src/content/geometry/rects";
import type { ExtensionSettings, ExtensionSettingsPatch } from "../src/shared/types";

vi.mock("../src/content/geometry/rects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/content/geometry/rects")>();
  return { ...actual, getSelectionRect: vi.fn(() => null) };
});

const getSelectionRectMock = vi.mocked(getSelectionRect);

const store = new Map<string, unknown>();
const changeListeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];
let currentSettings: ExtensionSettings;

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function merge(patch: ExtensionSettingsPatch): ExtensionSettings {
  return mergeSettings(currentSettings, patch);
}

function emitSettingsChange(next: ExtensionSettings): void {
  currentSettings = next;
  store.set(STORAGE_KEY, next);
  for (const listener of changeListeners) {
    listener({ [STORAGE_KEY]: { newValue: next } }, "local");
  }
}

async function applySettings(patch: ExtensionSettingsPatch): Promise<void> {
  emitSettingsChange(merge(patch));
  await flush();
}

function createTextarea(value: string): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 300, bottom: 160, width: 200, height: 60 }) as DOMRect;
  document.body.append(textarea);
  return textarea;
}

function focusIn(target: HTMLElement): void {
  target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

let activeTextareas: HTMLTextAreaElement[] = [];

beforeAll(async () => {
  currentSettings = mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW" });
  store.set(STORAGE_KEY, currentSettings);

  vi.stubGlobal("browser", {
    runtime: {
      getURL: () => "icon.svg",
      sendMessage: vi.fn(async (message: { type: string; patch?: ExtensionSettingsPatch; hostname?: string; enabled?: boolean }) => {
        if (message.type === "settings/update" && message.patch) {
          emitSettingsChange(merge(message.patch));
          return currentSettings;
        }
        if (message.type === "site/toggle" && message.hostname !== undefined) {
          emitSettingsChange(
            merge({ siteEnabledMap: { [message.hostname]: Boolean(message.enabled) } }),
          );
          return currentSettings;
        }
        return currentSettings;
      }),
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            store.set(key, value);
          }
        }),
      },
      onChanged: {
        addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => {
          changeListeners.push(listener);
        },
      },
    },
  });

  vi.stubGlobal("defineContentScript", (config: { main: () => Promise<void> }) => config);
  const module = await import("./content");
  await (module.default as unknown as { main: () => Promise<void> }).main();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.useRealTimers();
  for (const textarea of activeTextareas) {
    textarea.remove();
  }
  activeTextareas = [];
  state.activeIssues = [];
  state.popoverIssueId = null;
  if (state.activeElement) {
    state.activeElement.classList.remove(ACTIVE_CLASS);
    state.activeElement = null;
  }
  hideLauncher();
  hideSelectionToolbar();
  hideMainPanel();
  window.getSelection()?.removeAllRanges();
  getSelectionRectMock.mockReturnValue(null);
  emitSettingsChange(
    mergeSettings(DEFAULT_SETTINGS, { enabled: true, showOnSelection: true, defaultVariant: "zh-TW" }),
  );
  await flush();
});

describe("content 脚本初始化", () => {
  it("注册正文动作处理器", () => {
    expect(typeof state.actions?.replace).toBe("function");
    expect(typeof state.actions?.ignore).toBe("function");
    expect(typeof state.actions?.allow).toBe("function");
  });
});

describe("输入检测", () => {
  it("聚焦中文输入框后延迟检测并标记活跃元素", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件默认");
    activeTextareas.push(textarea);

    focusIn(textarea);
    expect(textarea.classList.contains(ACTIVE_CLASS)).toBe(true);
    expect(state.activeIssues).toEqual([]);

    await vi.advanceTimersByTimeAsync(300);
    expect(state.activeIssues.map((issue) => issue.sourceText)).toEqual(["软件", "默认"]);
  });

  it("输入时先进入编辑态，停顿后再检测", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    focusIn(textarea);
    await vi.advanceTimersByTimeAsync(300);

    textarea.value = "软件视频";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(ensureCvlLauncher().dataset.state).toBe("editing");

    await vi.advanceTimersByTimeAsync(300);
    expect(state.activeIssues.map((issue) => issue.sourceText)).toEqual(["软件", "视频"]);
  });

  it("粘贴后立即检测", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    focusIn(textarea);
    await vi.advanceTimersByTimeAsync(300);

    textarea.value = "软件默认";
    textarea.dispatchEvent(new Event("paste", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(state.activeIssues).toHaveLength(2);
  });

  it("切到非编辑元素时清空状态", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    focusIn(textarea);
    await vi.advanceTimersByTimeAsync(300);
    expect(state.activeIssues).toHaveLength(1);

    const div = document.createElement("div");
    document.body.append(div);
    focusIn(div);
    await vi.advanceTimersByTimeAsync(0);

    expect(state.activeElement).toBeNull();
    expect(state.activeIssues).toEqual([]);
  });

  it("扩展或站点关闭时不检测", async () => {
    await applySettings({ enabled: false });
    vi.useFakeTimers();

    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    focusIn(textarea);
    await vi.advanceTimersByTimeAsync(300);

    expect(state.activeIssues).toEqual([]);
  });
});

describe("选区工具条", () => {
  it("鼠标选中中文后展示工具条", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件很好用");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    getSelectionRectMock.mockReturnValue({
      left: 100,
      top: 100,
      right: 140,
      bottom: 120,
      width: 40,
      height: 20,
    });

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(ensureSelectionToolbar().dataset.hidden).toBe("false");
  });

  it("关闭选区提示时不展示工具条", async () => {
    await applySettings({ showOnSelection: false });
    vi.useFakeTimers();

    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    getSelectionRectMock.mockReturnValue({
      left: 0,
      top: 0,
      right: 10,
      bottom: 10,
      width: 10,
      height: 10,
    });

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("选区折叠时隐藏工具条", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    getSelectionRectMock.mockReturnValue({
      left: 0,
      top: 0,
      right: 10,
      bottom: 10,
      width: 10,
      height: 10,
    });
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ensureSelectionToolbar().dataset.hidden).toBe("false");

    textarea.setSelectionRange(1, 1);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });
});

describe("快捷键", () => {
  async function pressToggle(): Promise<KeyboardEvent> {
    const event = new KeyboardEvent("keydown", {
      key: "u",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    await flush();
    return event;
  }

  it("切换启用状态并阻止默认行为", async () => {
    const event = await pressToggle();
    expect(event.defaultPrevented).toBe(true);
    expect(currentSettings.enabled).toBe(false);
  });

  it("同一组合键下优先执行转换选区", async () => {
    await applySettings({
      shortcuts: {
        toggleEnabled: { ctrl: true, meta: false, alt: false, shift: true, key: "U" },
        convertSelection: { ctrl: true, meta: false, alt: false, shift: true, key: "U" },
      },
    });
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    getSelectionRectMock.mockReturnValue({
      left: 0,
      top: 0,
      right: 10,
      bottom: 10,
      width: 10,
      height: 10,
    });

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "u",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(textarea.value).toBe("軟體");
    expect(currentSettings.enabled).toBe(true);
  });

  it("设置视图打开时不响应快捷键", async () => {
    const mainPanel = await import("../src/content/ui/mainPanel");
    const panel = mainPanel.ensureMainPanel();
    panel.dataset.hidden = "false";
    panel.dataset.view = "settings";

    const before = currentSettings.enabled;
    await pressToggle();
    expect(currentSettings.enabled).toBe(before);

    panel.dataset.hidden = "true";
    panel.dataset.view = "review";
  });
});

describe("外部点击与设置同步", () => {
  it("点击扩展 UI 之外区域时收起浮层", () => {
    const div = document.createElement("div");
    document.body.append(div);
    document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

    expect(ensureCvlLauncher().dataset.expanded).toBe("false");
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("存储变更后使用新变体重新检测", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    focusIn(textarea);
    await vi.advanceTimersByTimeAsync(300);
    expect(state.activeIssues[0]?.suggestions[0]?.value).toBe("軟體");

    vi.useRealTimers();
    emitSettingsChange(merge({ defaultVariant: "zh-HK" }));
    await flush();
    expect(state.activeIssues[0]?.suggestions[0]?.value).toBe("軟件");
  });

  it("忽略非 local 区域或无关键的存储变更", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    focusIn(textarea);
    await vi.advanceTimersByTimeAsync(300);

    // 预置新变体但只以非法区 / 无关键触发，内部设置不应更新。
    store.set(STORAGE_KEY, merge({ defaultVariant: "zh-HK" }));
    for (const listener of changeListeners) {
      listener({ [STORAGE_KEY]: { newValue: null } }, "sync");
      listener({}, "local");
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(state.activeIssues[0]?.suggestions[0]?.value).toBe("軟體");
  });
});

async function activate(value: string): Promise<HTMLTextAreaElement> {
  vi.useFakeTimers();
  const textarea = createTextarea(value);
  activeTextareas.push(textarea);
  focusIn(textarea);
  await vi.advanceTimersByTimeAsync(300);
  return textarea;
}

describe("正文动作", () => {
  it("替换建议项后重新检测", async () => {
    const textarea = await activate("软件");
    const issue = state.activeIssues[0];
    expect(issue?.sourceText).toBe("软件");

    await state.actions!.replace!(issue);
    await vi.advanceTimersByTimeAsync(0);

    expect(textarea.value).toBe("軟體");
    expect(state.activeIssues).toEqual([]);
  });

  it("忽略建议项后从结果中移除", async () => {
    await activate("软件默认");
    const issue = state.activeIssues[0];
    expect(state.activeIssues).toHaveLength(2);

    await state.actions!.ignore!(issue);
    await vi.advanceTimersByTimeAsync(0);

    expect(state.activeIssues.some((item) => item.id === issue.id)).toBe(false);
  });

  it("允许词汇后写入设置并停止提示", async () => {
    await activate("软件");
    const issue = state.activeIssues[0];

    await state.actions!.allow!(issue);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(currentSettings.userDictionary.allowTerms["zh-TW"]).toContain("软件");
    expect(state.activeIssues).toEqual([]);
  });

  it("没有活跃元素时动作安全返回", async () => {
    await activate("软件");
    const issue = state.activeIssues[0];
    state.activeElement = null;
    state.activeIssues = [];

    await expect(state.actions!.replace!(issue)).resolves.toBeUndefined();
    await expect(state.actions!.ignore!(issue)).resolves.toBeUndefined();
    await expect(state.actions!.allow!(issue)).resolves.toBeUndefined();
  });

  it("聚焦空白输入框时清空问题", async () => {
    const textarea = await activate("软件");
    expect(state.activeIssues).toHaveLength(1);

    textarea.value = "   ";
    textarea.dispatchEvent(new Event("paste", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(state.activeIssues).toEqual([]);
  });
});

describe("选区工具条补充", () => {
  const RECT = { left: 10, top: 20, right: 60, bottom: 40, width: 50, height: 20 };

  function selectNodeContents(element: Node): void {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  it("contenteditable 选区转换为目标变体", async () => {
    vi.useFakeTimers();
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    editable.textContent = "软件";
    document.body.append(editable);
    selectNodeContents(editable);
    getSelectionRectMock.mockReturnValue(RECT);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ensureSelectionToolbar().dataset.hidden).toBe("false");

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(editable.textContent).toBe("軟體");
    editable.remove();
  });

  it("选区落在扩展工具条内时忽略", async () => {
    vi.useFakeTimers();
    selectNodeContents(ensureSelectionToolbar());
    getSelectionRectMock.mockReturnValue(RECT);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("非中文选区不展示工具条", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("abc");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 3);
    getSelectionRectMock.mockReturnValue(RECT);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("超长选区不展示工具条", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("軟".repeat(20001));
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 20001);
    getSelectionRectMock.mockReturnValue(RECT);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("无法测量选区位置时不展示工具条", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    getSelectionRectMock.mockReturnValue(null);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("非左键点击与触摸结束的行为", async () => {
    vi.useFakeTimers();
    const textarea = createTextarea("软件");
    activeTextareas.push(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    getSelectionRectMock.mockReturnValue(RECT);

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 2 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");

    document.dispatchEvent(new Event("touchend", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ensureSelectionToolbar().dataset.hidden).toBe("false");
  });
});

describe("滚动与尺寸变化", () => {
  it("合并滚动事件并在 resize 时刷新装饰", async () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }) as typeof globalThis.requestAnimationFrame;

    try {
      window.dispatchEvent(new Event("resize"));
      expect(frames).toHaveLength(1);

      // 已有调度时再次滚动直接返回，不重复入队。
      document.dispatchEvent(new Event("scroll"));
      expect(frames).toHaveLength(1);

      frames[0](0);
      expect(frames).toHaveLength(1);

      const textarea = createTextarea("软件");
      activeTextareas.push(textarea);
      focusIn(textarea);
      await vi.advanceTimersByTimeAsync(300);

      document.dispatchEvent(new Event("scroll"));
      expect(frames).toHaveLength(2);
      frames[1](0);

      expect(state.activeIssues).toHaveLength(1);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });
});

describe("快捷键补充", () => {
  function press(key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      key,
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
    document.dispatchEvent(event);
    return event;
  }

  it("切换审阅面板开关", async () => {
    await activate("软件");
    press("y");
    await vi.advanceTimersByTimeAsync(0);

    expect(isMainPanelOpen()).toBe(true);
    expect(getMainPanelView()).toBe("review");

    press("y");
    await vi.advanceTimersByTimeAsync(0);
    expect(isMainPanelOpen()).toBe(false);
  });

  it("审阅面板未打开时接受下一个建议不生效", async () => {
    const textarea = await activate("软件");
    press("l");
    await vi.advanceTimersByTimeAsync(0);

    expect(textarea.value).toBe("软件");
  });

  it("审阅面板打开后接受下一个建议", async () => {
    const textarea = await activate("软件");
    press("y");
    await vi.advanceTimersByTimeAsync(0);
    expect(isMainPanelOpen()).toBe(true);

    press("l");
    await vi.advanceTimersByTimeAsync(0);

    expect(textarea.value).toBe("軟體");
  });

  it("禁用时不打开审阅面板", async () => {
    vi.useRealTimers();
    await applySettings({ enabled: false });
    await activate("软件");

    const event = press("y");
    await vi.advanceTimersByTimeAsync(0);

    expect(isMainPanelOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("未绑定组合键不拦截事件", async () => {
    press("z", { shiftKey: false, ctrlKey: false, meta: false });
    expect(state.activeIssues).toEqual([]);

    const event = press("z");
    expect(event.defaultPrevented).toBe(false);
  });

  it("点击扩展浮层内部不收起源浮层", () => {
    const launcher = ensureCvlLauncher();
    launcher.dataset.expanded = "true";

    launcher.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(launcher.dataset.expanded).toBe("true");

    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(launcher.dataset.expanded).toBe("false");
  });
});
