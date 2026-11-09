// popup 词典页（entrypoints/popup/DictPage.tsx）的交互：新增、编辑、删除、清空、切换变体。
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/core/storage";
import type { ExtensionSettings, ExtensionSettingsPatch } from "../src/shared/types";
import { DictPage } from "../entrypoints/popup/DictPage";

function bulkSettings(count: number): ExtensionSettings {
  return mergeSettings(base, {
    userDictionary: {
      phrases: {
        "zh-TW": Array.from({ length: count }, (_, i) => ({
          id: `b${i}`, from: `Word${i}`, to: `词${i}`, enabled: true,
        })),
      },
    },
  });
}

const base = mergeSettings(DEFAULT_SETTINGS, {
  defaultVariant: "zh-TW",
  userDictionary: {
    phrases: {
      "zh-TW": [{ id: "a", from: "视频", to: "影片", enabled: true }],
      "zh-HK": [{ id: "h", from: "软件", to: "軟件", enabled: true }],
    },
  },
});

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function mount(initial: ExtensionSettings = base) {
  const host = document.createElement("div");
  document.body.append(host);
  let current: ExtensionSettings = initial;
  const onBack = vi.fn();
  const update = vi.fn(async (patch: ExtensionSettingsPatch) => {
    current = mergeSettings(current, patch);
    await render();
  });
  const render = async () => {
    await act(async () => {
      root ??= createRoot(host);
      root.render(createElement(DictPage, { settings: current, update, onBack }));
    });
  };
  await render();
  return { host, update, onBack, get current() { return current; } };
}

async function click(host: Element, selector: string): Promise<void> {
  await act(async () => {
    host.querySelector<HTMLElement>(selector)!.click();
  });
}

async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("popup DictPage", () => {
  it("头部有返回按钮与标题，actions 菜单在头部 trailing 位置", async () => {
    const ctx = await mount();
    const header = ctx.host.querySelector(".cvl-settings-header")!;
    expect(header.querySelector(".cvl-settings-title")?.textContent).not.toBe("");
    expect(header.querySelector(".cvl-settings-header-actions .cvl-dict-menu-btn")).not.toBeNull();
    expect(ctx.host.querySelector(".cvl-settings-body .cvl-dict-menu-btn")).toBeNull();
    await click(ctx.host, ".cvl-settings-back");
    expect(ctx.onBack).toHaveBeenCalledTimes(1);
  });

  it("新增：填写后保存写入所选变体，空值不提交", async () => {
    const ctx = await mount();
    await click(ctx.host, ".cvl-dict-footer button");
    await click(ctx.host, ".cvl-dict-edit-actions button");
    expect(ctx.update).not.toHaveBeenCalled();

    const [from, to] = ctx.host.querySelectorAll<HTMLInputElement>(".cvl-dict-edit input");
    await type(from, "鼠标");
    await type(to, "滑鼠");
    await click(ctx.host, ".cvl-dict-edit-actions button");

    expect(ctx.current.userDictionary.phrases["zh-TW"].map((p) => [p.from, p.to])).toEqual([
      ["视频", "影片"],
      ["鼠标", "滑鼠"],
    ]);
  });

  it("编辑：回填原值并保存修改", async () => {
    const ctx = await mount();
    await click(ctx.host, ".cvl-dict-item-actions button:first-child");
    const [from, to] = ctx.host.querySelectorAll<HTMLInputElement>(".cvl-dict-edit input");
    expect([from.value, to.value]).toEqual(["视频", "影片"]);
    await type(to, "短片");
    await click(ctx.host, ".cvl-dict-edit-actions button");
    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([
      { id: "a", from: "视频", to: "短片", enabled: true },
    ]);
  });

  it("删除只影响当前变体", async () => {
    const ctx = await mount();
    await click(ctx.host, ".cvl-dict-item-actions button:nth-child(2)");
    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([]);
    expect(ctx.current.userDictionary.phrases["zh-HK"]).toHaveLength(1);
  });

  it("切换变体下拉只换列表，不触发更新", async () => {
    const ctx = await mount();
    const select = ctx.host.querySelector<HTMLSelectElement>(".cvl-dict-variant")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      setter.call(select, "zh-HK");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(ctx.host.querySelector(".cvl-settings-rule-from")?.textContent).toBe("软件");
    expect(ctx.update).not.toHaveBeenCalled();
  });

  it("清空：确认后清空当前变体，取消则不动", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const ctx = await mount();

    await click(ctx.host, ".cvl-dict-menu-btn");
    await click(ctx.host, ".cvl-dict-menu-list button:nth-child(4)");
    expect(ctx.update).not.toHaveBeenCalled();

    await click(ctx.host, ".cvl-dict-menu-btn");
    await click(ctx.host, ".cvl-dict-menu-list button:nth-child(4)");
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([]);
    expect(ctx.current.userDictionary.phrases["zh-HK"]).toHaveLength(1);
  });

  it("菜单展开后点击面板其他区域收起", async () => {
    const ctx = await mount();
    await click(ctx.host, ".cvl-dict-menu-btn");
    expect(ctx.host.querySelector(".cvl-dict-menu-list")).not.toBeNull();
    await click(ctx.host, ".cvl-settings-rule-list");
    expect(ctx.host.querySelector(".cvl-dict-menu-list")).toBeNull();
  });

  it("搜索框默认收起，点击图标展开，空内容失焦后收起", async () => {
    const ctx = await mount(bulkSettings(5));
    const toolbar = ctx.host.querySelector<HTMLElement>(".cvl-dict-toolbar")!;
    expect(toolbar.dataset.search).toBe("closed");

    await click(ctx.host, ".cvl-dict-search-btn");
    expect(toolbar.dataset.search).toBe("open");
    expect(document.activeElement).toBe(ctx.host.querySelector(".cvl-dict-search"));

    await act(async () => {
      ctx.host.querySelector<HTMLInputElement>(".cvl-dict-search")!.blur();
    });
    expect(toolbar.dataset.search).toBe("closed");
  });

  it("搜索按原词或替换词过滤，没有匹配时给出提示", async () => {
    const ctx = await mount(bulkSettings(30));
    const input = ctx.host.querySelector<HTMLInputElement>(".cvl-dict-search")!;
    await type(input, "word2");
    expect(ctx.host.querySelectorAll(".cvl-settings-rule-item")).toHaveLength(11);
    await type(input, "不存在");
    expect(ctx.host.querySelector(".cvl-dict-empty")).not.toBeNull();
    expect(ctx.host.querySelectorAll(".cvl-settings-rule-item")).toHaveLength(0);
  });

  it("分批显示：100 条一批，显示更多直到全部", async () => {
    const ctx = await mount(bulkSettings(250));
    const rows = () => ctx.host.querySelectorAll(".cvl-settings-rule-item").length;
    expect(rows()).toBe(100);
    await click(ctx.host, ".cvl-dict-more button");
    expect(rows()).toBe(200);
    await click(ctx.host, ".cvl-dict-more button");
    expect(rows()).toBe(250);
    expect(ctx.host.querySelector(".cvl-dict-more")).toBeNull();
  });

  it("添加一项清掉搜索并展开全部", async () => {
    const ctx = await mount(bulkSettings(250));
    await type(ctx.host.querySelector<HTMLInputElement>(".cvl-dict-search")!, "Word1");
    await click(ctx.host, ".cvl-dict-footer button");
    expect(ctx.host.querySelector<HTMLInputElement>(".cvl-dict-search")!.value).toBe("");
    expect(ctx.host.querySelectorAll(".cvl-settings-rule-item:not(.cvl-dict-edit)")).toHaveLength(250);
  });
});
