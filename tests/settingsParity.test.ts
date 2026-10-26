// 页内设置面板（src/content/ui/settingsView.ts，HTML 字符串）与 popup
// （entrypoints/popup/App.tsx，React）是两份独立实现、共用 settings.css。
// 本测试渲染两者并比较 section 的结构与文案，任何一边漏改都会失败。
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/core/storage";
import type { PopupState } from "../src/shared/types";

const settings = mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW" });

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
