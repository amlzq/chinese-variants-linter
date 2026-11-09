import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../../core/storage";
import type { ExtensionSettings, ExtensionSettingsPatch } from "../../shared/types";
import { MAX_PHRASES_PER_VARIANT } from "../../shared/phraseCsv";
import {
  bindDictPageEvents,
  createDictPageState,
  dismissDictLayer,
  getDictPageMarkup,
  renderDictHeaderActions,
  type DictPageState,
} from "./dictView";

const settings = mergeSettings(DEFAULT_SETTINGS, {
  defaultVariant: "zh-TW",
  userDictionary: {
    phrases: {
      "zh-TW": [{ id: "rule-1", from: "视频", to: "影片", enabled: true }],
      "zh-HK": [{ id: "hk-1", from: "软件", to: "軟件", enabled: true }],
    },
  },
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 与 settingsView 相同的渲染 / 绑定回路，便于测试交互。 */
function setup(initial: ExtensionSettings = settings, state: DictPageState = createDictPageState("zh-TW")) {
  // 与 settingsView 一致：actions 菜单在头部 trailing 位置，列表在 body。
  const root = document.createElement("div");
  root.className = "cvl-settings-view";
  const header = document.createElement("div");
  header.className = "cvl-settings-header";
  const actions = document.createElement("div");
  actions.className = "cvl-settings-header-actions";
  header.append(actions);
  const body = document.createElement("div");
  root.append(header, body);
  document.body.append(root);
  let current = initial;
  const update = vi.fn(async (patch: ExtensionSettingsPatch) => {
    current = mergeSettings(current, patch);
    render();
  });
  const render = () => {
    body.innerHTML = getDictPageMarkup(current, state);
    const ctx = { getSettings: () => current, getState: () => state, update, rerender: render };
    bindDictPageEvents(body, ctx);
    renderDictHeaderActions(actions, root, ctx);
  };
  render();
  return { body, root, state, update, get current() { return current; } };
}

function click(body: HTMLElement, selector: string): void {
  body.querySelector<HTMLElement>(selector)!.click();
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("getDictPageMarkup", () => {
  it("只展示所选变体下的词组", () => {
    const { body } = setup();
    expect(body.querySelectorAll(".cvl-settings-rule-item")).toHaveLength(1);
    expect(body.querySelector(".cvl-settings-rule-from")?.textContent).toBe("视频");
  });

  it("没有词组时居中展示占位文案", () => {
    const { body } = setup(DEFAULT_SETTINGS);
    expect(body.querySelector(".cvl-dict-empty")).not.toBeNull();
    expect(body.querySelector("[data-dict-action='removePhrase']")).toBeNull();
  });

  it("转义词组文本", () => {
    const evil = mergeSettings(settings, {
      userDictionary: { phrases: { "zh-TW": [{ id: "x", from: "<b>a</b>", to: "b", enabled: true }] } },
    });
    const { body } = setup(evil);
    expect(body.querySelector("b")).toBeNull();
  });
});

describe("数量上限", () => {
  it("已满时「添加一项」按钮禁用", () => {
    const full = mergeSettings(settings, {
      userDictionary: {
        phrases: {
          "zh-TW": Array.from({ length: MAX_PHRASES_PER_VARIANT }, (_, i) => ({
            id: `p${i}`, from: `a${i}`, to: `b${i}`, enabled: true,
          })),
        },
      },
    });
    const { body } = setup(full);
    expect(body.querySelector<HTMLButtonElement>("[data-dict-action='addItem']")!.disabled).toBe(true);
  });
});

describe("变体下拉", () => {
  it("切换后展示另一份词典，且不改动 defaultVariant", async () => {
    const ctx = setup();
    const select = ctx.body.querySelector<HTMLSelectElement>("[data-dict-input='dictVariant']")!;
    select.value = "zh-HK";
    select.dispatchEvent(new Event("change"));

    expect(ctx.body.querySelector(".cvl-settings-rule-from")?.textContent).toBe("软件");
    expect(ctx.current.defaultVariant).toBe("zh-TW");
    expect(ctx.update).not.toHaveBeenCalled();
  });
});

describe("actions 菜单", () => {
  it("菜单在头部 trailing 位置而不在 body 内", () => {
    const ctx = setup();
    expect(ctx.root.querySelector(".cvl-settings-header .cvl-settings-header-actions .cvl-dict-menu-btn")).not.toBeNull();
    expect(ctx.body.querySelector(".cvl-dict-menu-btn")).toBeNull();
  });

  it("点击按钮展开四个菜单项，点击外部收起", () => {
    const ctx = setup();
    expect(ctx.root.querySelector(".cvl-dict-menu-list")).toBeNull();
    click(ctx.root, "[data-dict-action='toggleMenu']");
    const items = [...ctx.root.querySelectorAll<HTMLElement>("[data-dict-menu]")].map((el) => el.dataset.dictMenu);
    expect(items).toEqual(["import", "export", "template", "clear"]);

    ctx.body.querySelector<HTMLElement>(".cvl-settings-rule-list")!.click();
    expect(ctx.root.querySelector(".cvl-dict-menu-list")).toBeNull();
  });

  it("清空：确认后只清空当前变体", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const ctx = setup();
    click(ctx.root, "[data-dict-action='toggleMenu']");
    click(ctx.root, "[data-dict-menu='clear']");
    await flush();

    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([]);
    expect(ctx.current.userDictionary.phrases["zh-HK"]).toHaveLength(1);
  });

  it("清空：取消确认则不改动", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const ctx = setup();
    click(ctx.root, "[data-dict-action='toggleMenu']");
    click(ctx.root, "[data-dict-menu='clear']");
    await flush();
    expect(ctx.update).not.toHaveBeenCalled();
  });

  it("导出 / 下载模板触发文件下载", async () => {
    const created: string[] = [];
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      created.push(this.download);
    });
    const ctx = setup();
    click(ctx.root, "[data-dict-action='toggleMenu']");
    click(ctx.root, "[data-dict-menu='export']");
    click(ctx.root, "[data-dict-action='toggleMenu']");
    click(ctx.root, "[data-dict-menu='template']");
    await flush();

    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(created).toEqual(["custom-phrases-zh-TW.csv", "custom-phrases-template.csv"]);
  });
});

describe("新增与编辑", () => {
  it("底部 Add item 展开草稿行，保存后写入当前变体", async () => {
    const ctx = setup();
    click(ctx.body, "[data-dict-action='addItem']");
    expect(ctx.body.querySelector("[data-dict-action='addItem']")).toBeNull();

    ctx.body.querySelector<HTMLInputElement>("[data-dict-input='editFrom']")!.value = " 鼠标 ";
    ctx.body.querySelector<HTMLInputElement>("[data-dict-input='editTo']")!.value = " 滑鼠 ";
    click(ctx.body, "[data-dict-action='saveItem']");
    await flush();

    expect(ctx.current.userDictionary.phrases["zh-TW"].map((p) => [p.from, p.to])).toEqual([
      ["视频", "影片"],
      ["鼠标", "滑鼠"],
    ]);
    expect(ctx.state.editingId).toBeNull();
  });

  it("新增时有空值不提交，取消则撤销草稿", async () => {
    const ctx = setup();
    click(ctx.body, "[data-dict-action='addItem']");
    click(ctx.body, "[data-dict-action='saveItem']");
    await flush();
    expect(ctx.update).not.toHaveBeenCalled();

    click(ctx.body, "[data-dict-action='cancelEdit']");
    expect(ctx.body.querySelector(".cvl-dict-edit")).toBeNull();
    expect(ctx.body.querySelector("[data-dict-action='addItem']")).not.toBeNull();
  });

  it("编辑按钮回填原值，回车保存修改", async () => {
    const ctx = setup();
    click(ctx.body, "[data-dict-action='editItem']");
    const from = ctx.body.querySelector<HTMLInputElement>("[data-dict-input='editFrom']")!;
    const to = ctx.body.querySelector<HTMLInputElement>("[data-dict-input='editTo']")!;
    expect([from.value, to.value]).toEqual(["视频", "影片"]);

    to.value = "短片";
    to.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();

    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([
      { id: "rule-1", from: "视频", to: "短片", enabled: true },
    ]);
  });

  it("点击删除只移除当前变体下该词组", async () => {
    const ctx = setup();
    click(ctx.body, "[data-dict-action='removePhrase']");
    await flush();
    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([]);
    expect(ctx.current.userDictionary.phrases["zh-HK"]).toHaveLength(1);
  });
});

function bulk(count: number): ExtensionSettings {
  return mergeSettings(settings, {
    userDictionary: {
      phrases: {
        "zh-TW": Array.from({ length: count }, (_, i) => ({
          id: `b${i}`, from: `Word${i}`, to: `词${i}`, enabled: true,
        })),
      },
    },
  });
}

function search(body: HTMLElement, value: string): void {
  const input = body.querySelector<HTMLInputElement>("[data-dict-input='dictSearch']")!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

describe("搜索", () => {
  it("按原词或替换词不区分大小写过滤，且不重建输入框", () => {
    const ctx = setup(bulk(30));
    const input = ctx.body.querySelector("[data-dict-input='dictSearch']");

    search(ctx.body, "word2");
    expect(ctx.body.querySelectorAll(".cvl-settings-rule-item")).toHaveLength(11);

    search(ctx.body, "词29");
    expect(ctx.body.querySelectorAll(".cvl-settings-rule-item")).toHaveLength(1);
    expect(ctx.body.querySelector("[data-dict-input='dictSearch']")).toBe(input);
  });

  it("没有匹配时展示「没有匹配」而不是「还没有词组」", () => {
    const ctx = setup(bulk(5));
    search(ctx.body, "不存在");
    const empty = ctx.body.querySelector(".cvl-dict-empty")!;
    expect(empty.textContent).not.toBe("");
    expect(empty.textContent).not.toBe(setup(DEFAULT_SETTINGS).body.querySelector(".cvl-dict-empty")!.textContent);
  });

  it("切换变体清空搜索词", () => {
    const ctx = setup(bulk(5));
    search(ctx.body, "Word1");
    const select = ctx.body.querySelector<HTMLSelectElement>("[data-dict-input='dictVariant']")!;
    select.value = "zh-HK";
    select.dispatchEvent(new Event("change"));
    expect(ctx.body.querySelector<HTMLInputElement>("[data-dict-input='dictSearch']")!.value).toBe("");
  });

  it("添加一项会清掉搜索并展开全部", () => {
    const ctx = setup(bulk(250));
    search(ctx.body, "Word1");
    click(ctx.body, "[data-dict-action='addItem']");
    expect(ctx.state.query).toBe("");
    expect(ctx.body.querySelectorAll(".cvl-settings-rule-item:not(.cvl-dict-edit)")).toHaveLength(250);
    expect(ctx.body.querySelector(".cvl-dict-edit")).not.toBeNull();
  });
});

describe("搜索框收起 / 展开", () => {
  const state = (body: HTMLElement) => body.querySelector<HTMLElement>(".cvl-dict-toolbar")!.dataset.search;

  it("默认收起，点击图标展开并聚焦输入框，空内容失焦后收起", () => {
    const ctx = setup(bulk(5));
    expect(state(ctx.body)).toBe("closed");

    click(ctx.body, "[data-dict-action='openSearch']");
    const input = ctx.body.querySelector<HTMLInputElement>("[data-dict-input='dictSearch']")!;
    expect(state(ctx.body)).toBe("open");
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(new Event("blur"));
    expect(state(ctx.body)).toBe("closed");
    expect(ctx.state.searchOpen).toBe(false);
  });

  it("有搜索词时失焦不收起；重新渲染后仍保持展开", () => {
    const ctx = setup(bulk(5));
    click(ctx.body, "[data-dict-action='openSearch']");
    search(ctx.body, "Word1");
    ctx.body.querySelector("[data-dict-input='dictSearch']")!.dispatchEvent(new Event("blur"));
    expect(state(ctx.body)).toBe("open");

    click(ctx.body, "[data-dict-action='editItem']");
    expect(state(ctx.body)).toBe("open");
  });

  it("收起 / 展开不重建结果区，点击其他按钮不会丢失", () => {
    const ctx = setup(bulk(5));
    const list = ctx.body.querySelector(".cvl-dict-results");
    click(ctx.body, "[data-dict-action='openSearch']");
    ctx.body.querySelector("[data-dict-input='dictSearch']")!.dispatchEvent(new Event("blur"));
    expect(ctx.body.querySelector(".cvl-dict-results")).toBe(list);
  });
});

describe("分批显示", () => {
  it("默认只渲染 100 条，「显示更多」每次再加一批直到全部显示", () => {
    const ctx = setup(bulk(250));
    const rows = () => ctx.body.querySelectorAll(".cvl-settings-rule-item").length;
    expect(rows()).toBe(100);
    expect(ctx.body.querySelector(".cvl-dict-more")).not.toBeNull();

    click(ctx.body, "[data-dict-action='showMore']");
    expect(rows()).toBe(200);
    click(ctx.body, "[data-dict-action='showMore']");
    expect(rows()).toBe(250);
    expect(ctx.body.querySelector(".cvl-dict-more")).toBeNull();
  });

  it("搜索后重新从第一批开始", () => {
    const ctx = setup(bulk(250));
    click(ctx.body, "[data-dict-action='showMore']");
    search(ctx.body, "Word");
    expect(ctx.body.querySelectorAll(".cvl-settings-rule-item")).toHaveLength(100);
  });

  it("少于一批时不出现「显示更多」", () => {
    const { body } = setup(bulk(100));
    expect(body.querySelector(".cvl-dict-more")).toBeNull();
  });
});

describe("dismissDictLayer（Esc 逐层收起）", () => {
  it("按菜单 → 编辑 → 搜索的顺序逐层收起，最后返回 false", () => {
    const state = createDictPageState("zh-TW");
    state.menuOpen = true;
    state.editingId = "rule-1";
    state.query = "软";
    state.searchOpen = true;
    state.limit = 300;

    expect(dismissDictLayer(state)).toBe(true);
    expect([state.menuOpen, state.editingId, state.query]).toEqual([false, "rule-1", "软"]);

    expect(dismissDictLayer(state)).toBe(true);
    expect([state.editingId, state.query]).toEqual([null, "软"]);

    expect(dismissDictLayer(state)).toBe(true);
    expect([state.query, state.searchOpen, state.limit]).toEqual(["", false, 100]);

    expect(dismissDictLayer(state)).toBe(false);
  });

  it("只展开了搜索框但没有内容时，Esc 也先收起搜索框", () => {
    const state = createDictPageState("zh-TW");
    state.searchOpen = true;
    expect(dismissDictLayer(state)).toBe(true);
    expect(state.searchOpen).toBe(false);
  });
});
