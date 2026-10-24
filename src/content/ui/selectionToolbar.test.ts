import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../../core/storage";
import { getSelectionRect } from "../geometry/rects";
import { SELECTION_TOOLBAR_ID } from "./styles";
import {
  ensureSelectionToolbar,
  hideSelectionToolbar,
  isSelectionToolbarOpen,
  repositionSelectionToolbar,
  showSelectionToolbar,
} from "./selectionToolbar";

vi.mock("../geometry/rects", () => ({
  getSelectionRect: vi.fn(() => null),
}));

const getSelectionRectMock = vi.mocked(getSelectionRect);

function createSettings() {
  return mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW" });
}

function createTextarea(value = "软件", start = 0, end = value.length): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.append(textarea);
  textarea.setSelectionRange(start, end);
  return textarea;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.stubGlobal("scrollX", 0);
  vi.stubGlobal("scrollY", 0);
  hideSelectionToolbar();
});

afterEach(() => {
  hideSelectionToolbar();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("ensureSelectionToolbar / 显隐", () => {
  it("只创建一个工具条并阻止 mousedown 默认行为", () => {
    const toolbar = ensureSelectionToolbar();
    expect(toolbar).toBe(ensureSelectionToolbar());
    expect(document.querySelectorAll(`#${SELECTION_TOOLBAR_ID}`)).toHaveLength(1);
    expect(isSelectionToolbarOpen()).toBe(false);

    const event = new MouseEvent("mousedown", { cancelable: true });
    toolbar.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("没有问题时隐藏工具条", () => {
    showSelectionToolbar({
      text: "hello",
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: createTextarea("hello"),
    });
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });
});

describe("showSelectionToolbar", () => {
  it("渲染问题数量、明细与转换按钮", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: createTextarea(),
    });

    const toolbar = ensureSelectionToolbar();
    expect(toolbar.dataset.hidden).toBe("false");
    expect(toolbar.dataset.expanded).toBe("false");
    expect(toolbar.querySelector(".cvl-sel-count")?.textContent).toContain("1");
    expect(toolbar.querySelector(".cvl-sel-detail-source")?.textContent).toBe("软件");
    expect(toolbar.querySelector(".cvl-sel-detail-target")?.textContent).toBe("軟體");
    expect(toolbar.querySelector<HTMLButtonElement>("[data-action='convert']")?.disabled).toBe(
      false,
    );
    expect(toolbar.querySelector("[data-action='convert']")?.textContent).toContain("中文台湾");
    expect(toolbar.querySelector("[data-action='convert']")?.getAttribute("title")).toBeNull();
  });

  it("不可编辑时禁用转换按钮并给出提示", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: null,
    });

    const convert = ensureSelectionToolbar().querySelector<HTMLButtonElement>(
      "[data-action='convert']",
    )!;
    expect(convert.disabled).toBe(true);
    expect(convert.getAttribute("title")).not.toBeNull();
  });

  it("位于视口右下角时工具条内收", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 1000, top: 750, right: 1020, bottom: 760, width: 20, height: 10 },
      editableTarget: createTextarea(),
    });

    const toolbar = ensureSelectionToolbar();
    // 默认宽度 280、高度 40（jsdom 无布局）
    expect(toolbar.style.left).toBe(`${1024 - 280 - 12}px`);
    expect(toolbar.style.top).toBe(`${750 - 40 - 8}px`);
  });

  it("锚点过窄时限制在左边距内", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: -100, top: 10, right: 0, bottom: 20, width: 10, height: 10 },
      editableTarget: createTextarea(),
    });
    expect(ensureSelectionToolbar().style.left).toBe("12px");
  });

  it("锚点过高时限制在上边距内", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 10, top: -100, right: 20, bottom: 730, width: 10, height: 10 },
      editableTarget: createTextarea(),
    });
    expect(ensureSelectionToolbar().style.top).toBe("12px");
  });

  it("点击详情按钮展开/收起明细", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: createTextarea(),
    });

    const toolbar = ensureSelectionToolbar();
    toolbar.querySelector<HTMLButtonElement>("[data-action='toggle']")!.click();
    expect(toolbar.dataset.expanded).toBe("true");

    toolbar.querySelector<HTMLButtonElement>("[data-action='toggle']")!.click();
    expect(toolbar.dataset.expanded).toBe("false");
  });
});

describe("转换与复制", () => {
  function showOnTextarea(textarea: HTMLTextAreaElement, onAfterReplace?: () => void): void {
    showSelectionToolbar({
      text: textarea.value,
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: textarea,
      onAfterReplace,
    });
  }

  it("点击转换替换选区并回调", async () => {
    const textarea = createTextarea("软件");
    const onAfterReplace = vi.fn();
    showOnTextarea(textarea, onAfterReplace);

    ensureSelectionToolbar().querySelector<HTMLButtonElement>("[data-action='convert']")!.click();
    await flush();

    expect(textarea.value).toBe("軟體");
    expect(onAfterReplace).toHaveBeenCalled();
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("选区已失效时不隐藏工具条", async () => {
    const textarea = createTextarea("软件");
    textarea.setSelectionRange(1, 1);
    showOnTextarea(textarea);

    ensureSelectionToolbar().querySelector<HTMLButtonElement>("[data-action='convert']")!.click();
    await flush();

    expect(textarea.value).toBe("软件");
    expect(ensureSelectionToolbar().dataset.hidden).toBe("false");
  });

  it("剪贴板写入成功后按钮短暂显示已复制", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const textarea = createTextarea("软件");
    showOnTextarea(textarea);
    const copy = ensureSelectionToolbar().querySelector<HTMLButtonElement>("[data-action='copy']")!;
    const original = copy.textContent;
    copy.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(writeText).toHaveBeenCalledWith("軟體");
    expect(copy.dataset.copied).toBe("true");

    await vi.advanceTimersByTimeAsync(1200);
    expect(copy.dataset.copied).toBe("false");
    expect(copy.textContent).toBe(original);
  });

  it("剪贴板不可用时回退到 execCommand", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
    });
    document.execCommand = vi.fn(() => true);

    const textarea = createTextarea("软件");
    showOnTextarea(textarea);
    const copy = ensureSelectionToolbar().querySelector<HTMLButtonElement>("[data-action='copy']")!;
    copy.click();
    await flush();

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(copy.dataset.copied).toBe("true");
  });

  it("回退复制失败时按钮保持原样", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
    });
    document.execCommand = vi.fn(() => false);

    const textarea = createTextarea("软件");
    showOnTextarea(textarea);
    const copy = ensureSelectionToolbar().querySelector<HTMLButtonElement>("[data-action='copy']")!;
    const original = copy.textContent;
    copy.click();
    await flush();

    expect(copy.dataset.copied).toBeUndefined();
    expect(copy.textContent).toBe(original);
  });
});

describe("repositionSelectionToolbar", () => {
  it("工具条未展示时不处理", () => {
    hideSelectionToolbar();
    getSelectionRectMock.mockReturnValue({
      left: 10,
      top: 20,
      right: 30,
      bottom: 40,
      width: 20,
      height: 20,
    });

    repositionSelectionToolbar();
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("取不到选区时隐藏工具条", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: createTextarea(),
    });
    getSelectionRectMock.mockReturnValue(null);

    repositionSelectionToolbar();
    expect(ensureSelectionToolbar().dataset.hidden).toBe("true");
  });

  it("按新的选区位置重新定位", () => {
    showSelectionToolbar({
      text: "软件",
      settings: createSettings(),
      anchorRect: { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 },
      editableTarget: createTextarea(),
    });
    getSelectionRectMock.mockReturnValue({
      left: 300,
      top: 400,
      right: 320,
      bottom: 420,
      width: 20,
      height: 20,
    });

    repositionSelectionToolbar();
    const toolbar = ensureSelectionToolbar();
    expect(toolbar.style.left).toBe("300px");
    expect(toolbar.style.top).toBe("428px");
  });
});
