import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../../core/storage";
import type { ExtensionSettings, ExtensionSettingsPatch } from "../../shared/types";
import {
  bindDictPageEvents,
  createDictPageState,
  getDictPageMarkup,
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
  const body = document.createElement("div");
  document.body.append(body);
  let current = initial;
  const update = vi.fn(async (patch: ExtensionSettingsPatch) => {
    current = mergeSettings(current, patch);
    render();
  });
  const render = () => {
    body.innerHTML = getDictPageMarkup(current, state);
    bindDictPageEvents(body, { getSettings: () => current, getState: () => state, update, rerender: render });
  };
  render();
  return { body, state, update, get current() { return current; } };
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
  it("点击按钮展开四个菜单项，点击外部收起", () => {
    const ctx = setup();
    expect(ctx.body.querySelector(".cvl-dict-menu-list")).toBeNull();
    click(ctx.body, "[data-dict-action='toggleMenu']");
    const items = [...ctx.body.querySelectorAll<HTMLElement>("[data-dict-menu]")].map((el) => el.dataset.dictMenu);
    expect(items).toEqual(["import", "export", "template", "clear"]);

    ctx.body.querySelector<HTMLElement>(".cvl-settings-rule-list")!.click();
    expect(ctx.body.querySelector(".cvl-dict-menu-list")).toBeNull();
  });

  it("清空：确认后只清空当前变体", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const ctx = setup();
    click(ctx.body, "[data-dict-action='toggleMenu']");
    click(ctx.body, "[data-dict-menu='clear']");
    await flush();

    expect(ctx.current.userDictionary.phrases["zh-TW"]).toEqual([]);
    expect(ctx.current.userDictionary.phrases["zh-HK"]).toHaveLength(1);
  });

  it("清空：取消确认则不改动", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const ctx = setup();
    click(ctx.body, "[data-dict-action='toggleMenu']");
    click(ctx.body, "[data-dict-menu='clear']");
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
    click(ctx.body, "[data-dict-action='toggleMenu']");
    click(ctx.body, "[data-dict-menu='export']");
    click(ctx.body, "[data-dict-action='toggleMenu']");
    click(ctx.body, "[data-dict-menu='template']");
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
