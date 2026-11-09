// 页内设置面板（src/content/ui/settingsView.ts，HTML 字符串）与 popup
// （entrypoints/popup/App.tsx，React）是两份独立实现、共用 settings.css。
// 本测试渲染两者并比较 section 的结构与文案，任何一边漏改都会失败。
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/core/storage";
import type { PopupState } from "../src/shared/types";

const settings = mergeSettings(DEFAULT_SETTINGS, {
  defaultVariant: "zh-TW",
  userDictionary: {
    phrases: {
      "zh-TW": [
        { id: "1", from: "出租车", to: "計程車", enabled: true },
        { id: "2", from: "软件", to: "軟體", enabled: true },
        // 超过一批（100 条），用来比较「显示更多」。
        ...Array.from({ length: 118 }, (_, i) => ({
          id: `bulk-${i}`, from: `批量词${i}`, to: `批量替换${i}`, enabled: true,
        })),
      ],
    },
  },
});

vi.mock("../src/core/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/core/storage")>();
  return { ...actual, getSettings: vi.fn(async () => settings) };
});
vi.mock("../src/shared/settingsClient", () => ({ updateSettings: vi.fn(), toggleSite: vi.fn() }));
vi.mock("../src/content/ui/mainPanel", () => ({
  getMainPanelView: vi.fn(() => "settings"),
  hideMainPanel: vi.fn(),
  isMainPanelOpen: vi.fn(() => true),
  showReviewView: vi.fn(),
}));
vi.mock("../src/content/ui/tooltip", () => ({ attachTooltip: vi.fn(), hideTooltip: vi.fn() }));
vi.mock("../src/content/ui/settings.css", () => ({}));

const text = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const texts = (root: Element, selector: string): string[] =>
  [...root.querySelectorAll(selector)].map(text);

/** 提取一个 section 的可比较结构（忽略 React/HTML 字符串的实现差异）。 */
function describeSection(section: Element) {
  return {
    heads: texts(section, "h3"),
    headDescs: texts(section, ".cvl-settings-section-head p"),
    rowTitles: texts(section, ".cvl-settings-row-title"),
    rowDescs: texts(section, ".cvl-settings-row-desc"),
    toggles: section.querySelectorAll(".cvl-settings-toggle input[type=checkbox]").length,
    selects: [...section.querySelectorAll("select")].map((s) =>
      [...s.options].map((o) => o.value),
    ),
    inputs: section.querySelectorAll(".cvl-settings-input:not(.cvl-settings-sc-input)").length,
    subheads: texts(section, ".cvl-settings-dict-subhead"),
    shortcutNames: texts(section, ".cvl-settings-sc-name"),
    empties: texts(section, "p.cvl-settings-empty"),
  };
}

function describeBody(body: Element) {
  return [...body.querySelectorAll(":scope > .cvl-settings-section")].map(describeSection);
}

async function renderInPage(): Promise<Element> {
  const { ensureSettingsView, showSettingsView } = await import("../src/content/ui/settingsView");
  document.body.append(ensureSettingsView());
  await showSettingsView();
  return document.querySelector(".cvl-settings-body")!;
}

async function renderPopup(hostname: string): Promise<Element> {
  const state: PopupState = { settings, hostname: hostname || null, siteEnabled: true };
  vi.stubGlobal("browser", { runtime: { sendMessage: vi.fn(async () => state) } });
  const { default: App } = await import("../entrypoints/popup/App");
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host).render(createElement(App));
  });
  return host.querySelector(".cvl-settings-body")!;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("设置界面：页内面板与 popup 结构一致", () => {
  for (const hostname of ["example.com", ""]) {
    it(`hostname=${JSON.stringify(hostname)} 时 section 结构与文案一致`, async () => {
      vi.stubGlobal("location", { hostname });
      // App 渲染时会 setRegion(detectDefaultRegion())，先渲染 popup 让两边使用同一语言。
      const popup = describeBody(await renderPopup(hostname));
      document.body.innerHTML = "";
      const inPage = describeBody(await renderInPage());

      expect(popup.length).toBeGreaterThan(0);
      expect(popup).toEqual(inPage);
    });
  }
});

async function click(selector: string): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  expect(el, selector).not.toBeNull();
  await act(async () => {
    el!.click();
  });
}

function describeDictPage(): unknown {
  const root = document.querySelector(".cvl-settings-view")!;
  const buttons = (selector: string) =>
    [...root.querySelectorAll<HTMLButtonElement>(selector)].map((b) => `${text(b)}|${b.disabled}`);
  return {
    title: text(root.querySelector(".cvl-settings-title")!),
    variants: [...root.querySelectorAll<HTMLOptionElement>(".cvl-dict-variant option")].map((o) => [o.value, o.selected]),
    items: [...root.querySelectorAll(".cvl-settings-rule-item:not(.cvl-dict-edit)")].map((item) => ({
      from: text(item.querySelector(".cvl-settings-rule-from")!),
      to: text(item.querySelector(".cvl-settings-rule-to")!),
      actions: [...item.querySelectorAll("button")].map(text),
    })),
    empty: texts(root, ".cvl-dict-empty"),
    footer: buttons(".cvl-dict-footer button"),
    menuLabel: root.querySelector(".cvl-dict-menu-btn")?.getAttribute("aria-label"),
    menuItems: texts(root, ".cvl-dict-menu-list button"),
    search: [
      root.querySelector<HTMLInputElement>(".cvl-dict-search")?.placeholder,
      root.querySelector<HTMLInputElement>(".cvl-dict-search")?.value,
    ],
    searchState: root.querySelector<HTMLElement>(".cvl-dict-toolbar")?.dataset.search,
    searchBtnLabel: root.querySelector(".cvl-dict-search-btn")?.getAttribute("aria-label"),
    more: texts(root, ".cvl-dict-more button"),
    editor: [...root.querySelectorAll<HTMLInputElement>(".cvl-dict-edit input")].map((i) => [i.placeholder, i.value]),
    editorButtons: texts(root, ".cvl-dict-edit-actions button"),
  };
}

async function typeSearch(value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(".cvl-dict-search")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** 依次进入词典页、展开菜单、进入编辑与新增，每一步比较两边的结构。 */
async function walkDictPage(): Promise<unknown[]> {
  const steps: unknown[] = [];
  await click(".cvl-settings-phrase-actions button:nth-child(2)");
  steps.push(describeDictPage());
  await click(".cvl-dict-menu-btn");
  steps.push(describeDictPage());
  await click(".cvl-dict-menu-btn");
  await click(".cvl-dict-item-actions button:first-child");
  steps.push(describeDictPage());
  await click(".cvl-dict-edit-actions button:nth-child(2)");
  await click(".cvl-dict-more button");
  steps.push(describeDictPage());
  await click(".cvl-dict-footer button");
  steps.push(describeDictPage());
  await click(".cvl-dict-edit-actions button:nth-child(2)");
  await click(".cvl-dict-search-btn");
  steps.push(describeDictPage());
  await typeSearch("软件");
  steps.push(describeDictPage());
  await typeSearch("不存在的词");
  steps.push(describeDictPage());
  return steps;
}

describe("词典页：页内面板与 popup 结构一致", () => {
  it("列表、菜单、编辑、新增、显示更多、搜索与无结果的结构与文案一致", async () => {
    vi.stubGlobal("location", { hostname: "example.com" });
    await renderPopup("example.com");
    const popup = await walkDictPage();
    document.body.innerHTML = "";
    await renderInPage();
    const inPage = await walkDictPage();

    expect(popup).toHaveLength(8);
    expect(popup).toEqual(inPage);
  }, 30_000);
});
