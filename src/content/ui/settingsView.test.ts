import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../../core/storage";
import type { ExtensionSettings, ExtensionSettingsPatch } from "../../shared/types";
import { SETTINGS_VIEW_ID } from "./styles";
import {
  ensureSettingsView,
  hideSettingsView,
  isSettingsViewOpen,
  showSettingsView,
} from "./settingsView";

vi.mock("./mainPanel", () => ({
  getMainPanelView: vi.fn(() => "settings"),
  hideMainPanel: vi.fn(),
  isMainPanelOpen: vi.fn(() => true),
  showReviewView: vi.fn(),
}));

vi.mock("../../core/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../core/storage")>();
  return {
    ...actual,
    getSettings: vi.fn(),
    isSiteEnabled: vi.fn(() => true),
  };
});

vi.mock("../../shared/settingsClient", () => ({
  updateSettings: vi.fn(),
  toggleSite: vi.fn(),
}));

vi.mock("./tooltip", () => ({
  attachTooltip: vi.fn(),
  hideTooltip: vi.fn(),
}));

const { getMainPanelView, hideMainPanel, isMainPanelOpen, showReviewView } = await import(
  "./mainPanel"
);
const { getSettings, isSiteEnabled } = await import("../../core/storage");
const { toggleSite, updateSettings } = await import("../../shared/settingsClient");

const getSettingsMock = vi.mocked(getSettings);
const isSiteEnabledMock = vi.mocked(isSiteEnabled);
const updateSettingsMock = vi.mocked(updateSettings);
const toggleSiteMock = vi.mocked(toggleSite);
const getMainPanelViewMock = vi.mocked(getMainPanelView);
const isMainPanelOpenMock = vi.mocked(isMainPanelOpen);

function buildSettings(patch: ExtensionSettingsPatch = {}): ExtensionSettings {
  return mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW", ...patch });
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): HTMLDivElement {
  return ensureSettingsView();
}

function body(): HTMLElement {
  return view().querySelector<HTMLElement>(".cvl-settings-body")!;
}

beforeEach(() => {
  // 真实流程中设置视图由主面板挂载到 document，测试中同样挂载以支持 focus/事件冒泡。
  document.body.append(ensureSettingsView());
  const settings = buildSettings();
  getSettingsMock.mockImplementation(async () => settings);
  isSiteEnabledMock.mockReturnValue(true);
  isMainPanelOpenMock.mockReturnValue(true);
  getMainPanelViewMock.mockReturnValue("settings");
  updateSettingsMock.mockImplementation(async (patch) => mergeSettings(settings, patch));
  toggleSiteMock.mockImplementation(async (hostname, enabled) =>
    mergeSettings(settings, { siteEnabledMap: { [hostname]: enabled } }),
  );
});

afterEach(() => {
  hideSettingsView();
  vi.resetAllMocks();
});

describe("ensureSettingsView", () => {
  it("只创建一个设置视图并挂载头部", () => {
    expect(ensureSettingsView()).toBe(ensureSettingsView());
    expect(document.querySelectorAll(`#${SETTINGS_VIEW_ID}`)).toHaveLength(1);
    expect(view().querySelector(".cvl-settings-title")).not.toBeNull();
    expect(view().classList.contains("cvl-settings-view")).toBe(true);
  });

  it("返回按钮回到评审视图，关闭按钮关闭面板", () => {
    ensureSettingsView().querySelector<HTMLButtonElement>(".cvl-settings-back")!.click();
    ensureSettingsView().querySelector<HTMLButtonElement>(".cvl-settings-close")!.click();

    expect(showReviewView).toHaveBeenCalled();
    expect(hideMainPanel).toHaveBeenCalled();
  });
});

describe("isSettingsViewOpen", () => {
  it("面板打开且处于设置视图时为 true", () => {
    expect(isSettingsViewOpen()).toBe(true);

    isMainPanelOpenMock.mockReturnValue(false);
    expect(isSettingsViewOpen()).toBe(false);

    isMainPanelOpenMock.mockReturnValue(true);
    getMainPanelViewMock.mockReturnValue("review");
    expect(isSettingsViewOpen()).toBe(false);
  });
});

describe("showSettingsView / hideSettingsView", () => {
  it("加载设置后渲染并显示视图", async () => {
    await showSettingsView();

    expect(getSettings).toHaveBeenCalled();
    expect(view().dataset.hidden).toBe("false");
    expect(body().querySelector("[data-setting='defaultVariant']")).not.toBeNull();
    expect(body().querySelector("[data-setting='detectionLevel']")).not.toBeNull();
    expect(body().querySelector("[data-setting='enabled']")).not.toBeNull();
    expect(body().querySelector("[data-setting='showOnSelection']")).not.toBeNull();
  });

  it("Esc 在非录制状态返回评审视图", async () => {
    await showSettingsView();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(showReviewView).toHaveBeenCalled();
  });

  it("设置视图未打开时 Esc 不处理", async () => {
    await showSettingsView();
    isMainPanelOpenMock.mockReturnValue(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(showReviewView).not.toHaveBeenCalled();
  });

  it("隐藏后移除键盘监听", async () => {
    await showSettingsView();
    hideSettingsView();

    expect(view().dataset.hidden).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(showReviewView).not.toHaveBeenCalled();
  });
});

describe("渲染设置项", () => {
  it("选中当前变体与检测级别", async () => {
    await showSettingsView();
    const variant = body().querySelector<HTMLSelectElement>("[data-setting='defaultVariant']")!;
    expect(variant.value).toBe("zh-TW");

    const detection = body().querySelector<HTMLSelectElement>("[data-setting='detectionLevel']")!;
    expect(detection.value).toBe("standard");
  });

  it("展示站点开关状态", async () => {
    await showSettingsView();
    const site = body().querySelector<HTMLInputElement>("input[data-site]")!;
    expect(site.dataset.site).toBe(location.hostname);
    expect(site.checked).toBe(true);
  });

  it("全站点默认开关默认未勾选且位于站点开关上方", async () => {
    await showSettingsView();
    const defaultToggle = body().querySelector<HTMLInputElement>("input[data-default-site]")!;
    expect(defaultToggle.checked).toBe(false);

    const inputs = [...body().querySelectorAll<HTMLInputElement>("input[data-default-site], input[data-site]")];
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toBe(defaultToggle);
  });

  it("全站点默认开关勾选时渲染为开启", async () => {
    getSettingsMock.mockResolvedValue(buildSettings({ defaultSiteEnabled: true }));
    await showSettingsView();

    expect(
      body().querySelector<HTMLInputElement>("input[data-default-site]")!.checked,
    ).toBe(true);
  });

  it("展示允许词与强制替换规则", async () => {
    getSettingsMock.mockResolvedValue(
      buildSettings({
        userDictionary: {
          allowTerms: { "zh-TW": ["軟體"] },
          forceReplaceRules: [
            { id: "rule-1", variant: "zh-TW", from: "视频", to: "影片", enabled: true },
          ],
        },
      }),
    );
    await showSettingsView();

    expect(body().querySelector("[data-dict-action='removeAllowTerm']")?.textContent).toContain(
      "軟體",
    );
    // 规则列表不再出现在设置页，只在「全部」词典页展示
    expect(body().querySelector(".cvl-settings-rule-from")).toBeNull();


    body().querySelector<HTMLButtonElement>("[data-dict-action='openDictList']")!.click();
    expect(body().querySelector(".cvl-settings-rule-from")?.textContent).toBe("视频");
    expect(body().querySelector(".cvl-settings-rule-to")?.textContent).toBe("影片");
  });

  it("词典页共用头部，返回回到设置页", async () => {
    await showSettingsView();
    const view = ensureSettingsView();
    const title = () => view.querySelector(".cvl-settings-title")!.textContent;
    const settingsTitle = title();

    body().querySelector<HTMLButtonElement>("[data-dict-action='openDictList']")!.click();
    expect(title()).not.toBe(settingsTitle);
    expect(body().querySelector("select[data-setting='defaultVariant']")).toBeNull();

    view.querySelector<HTMLButtonElement>(".cvl-settings-back")!.click();
    expect(title()).toBe(settingsTitle);
    expect(body().querySelector("select[data-setting='defaultVariant']")).not.toBeNull();
  });

  it("字典为空时展示占位文案", async () => {
    await showSettingsView();
    expect(body().querySelectorAll(".cvl-settings-empty").length).toBeGreaterThan(0);
    expect(body().querySelector("[data-dict-action='removeAllowTerm']")).toBeNull();
    expect(body().querySelector("[data-dict-action='removeForceRule']")).toBeNull();
  });

  it("快捷键列表展示已绑定与未绑定状态", async () => {
    getSettingsMock.mockResolvedValue(
      buildSettings({ shortcuts: { convertSelection: null } }),
    );
    await showSettingsView();

    expect(body().querySelector("[data-empty='true']")?.textContent).toBe("未设置");
    expect(body().querySelectorAll(".cvl-settings-shortcut-row").length).toBeGreaterThan(1);
    expect(body().querySelectorAll(".cvl-settings-sc-edit").length).toBeGreaterThan(0);
  });
});

describe("设置项变更", () => {
  it("切换启用开关", async () => {
    await showSettingsView();
    const checkbox = body().querySelector<HTMLInputElement>("[data-setting='enabled']")!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    await flush();

    expect(updateSettings).toHaveBeenCalledWith({ enabled: false });
  });

  it("切换选区弹出开关", async () => {
    await showSettingsView();
    const checkbox = body().querySelector<HTMLInputElement>("[data-setting='showOnSelection']")!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await flush();

    expect(updateSettings).toHaveBeenCalledWith({ showOnSelection: true });
  });

  it("切换目标变体与检测级别", async () => {
    await showSettingsView();
    const variant = body().querySelector<HTMLSelectElement>("[data-setting='defaultVariant']")!;
    variant.value = "zh-HK";
    variant.dispatchEvent(new Event("change"));

    const detection = body().querySelector<HTMLSelectElement>("[data-setting='detectionLevel']")!;
    detection.value = "relaxed";
    detection.dispatchEvent(new Event("change"));
    await flush();

    expect(updateSettings).toHaveBeenCalledWith({ defaultVariant: "zh-HK" });
    expect(updateSettings).toHaveBeenCalledWith({ detectionLevel: "relaxed" });
  });

  it("切换站点开关", async () => {
    await showSettingsView();
    const site = body().querySelector<HTMLInputElement>("input[data-site]")!;
    site.checked = false;
    site.dispatchEvent(new Event("change"));
    await flush();

    expect(toggleSite).toHaveBeenCalledWith(location.hostname, false);
  });

  it("切换全站点默认开关写入设置", async () => {
    await showSettingsView();
    const defaultToggle = body().querySelector<HTMLInputElement>("input[data-default-site]")!;
    defaultToggle.checked = true;
    defaultToggle.dispatchEvent(new Event("change"));
    await flush();

    expect(updateSettings).toHaveBeenCalledWith({ defaultSiteEnabled: true });
  });
});

describe("字典编辑", () => {
  it("点击按钮添加允许词", async () => {
    await showSettingsView();
    const input = body().querySelector<HTMLInputElement>("[data-dict-input='allowTerm']")!;
    input.value = " 滑鼠 ";
    body().querySelector<HTMLButtonElement>("[data-dict-action='addAllowTerm']")!.click();
    await flush();

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        userDictionary: expect.objectContaining({
          allowTerms: expect.objectContaining({ "zh-TW": ["滑鼠"] }),
        }),
      }),
    );
  });

  it("输入框回车添加允许词，空值忽略", async () => {
    await showSettingsView();
    const input = body().querySelector<HTMLInputElement>("[data-dict-input='allowTerm']")!;

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(updateSettings).not.toHaveBeenCalled();

    input.value = "軟體";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(updateSettings).toHaveBeenCalled();
  });

  it("点击标签移除允许词", async () => {
    getSettingsMock.mockResolvedValue(
      buildSettings({ userDictionary: { allowTerms: { "zh-TW": ["軟體"] } } }),
    );
    await showSettingsView();
    body().querySelector<HTMLButtonElement>("[data-dict-action='removeAllowTerm']")!.click();
    await flush();

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        userDictionary: expect.objectContaining({
          allowTerms: expect.objectContaining({ "zh-TW": [] }),
        }),
      }),
    );
  });

  it("添加强制替换规则并支持回车提交", async () => {
    await showSettingsView();
    const from = body().querySelector<HTMLInputElement>("[data-dict-input='forceFrom']")!;
    const to = body().querySelector<HTMLInputElement>("[data-dict-input='forceTo']")!;
    from.value = " 视频 ";
    to.value = " 影片 ";

    body().querySelector<HTMLButtonElement>("[data-dict-action='addForceRule']")!.click();
    await flush();

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        userDictionary: expect.objectContaining({
          forceReplaceRules: [
            expect.objectContaining({ variant: "zh-TW", from: "视频", to: "影片" }),
          ],
        }),
      }),
    );

    // 重新渲染后需重新查询输入框
    const nextFrom = body().querySelector<HTMLInputElement>("[data-dict-input='forceFrom']")!;
    const nextTo = body().querySelector<HTMLInputElement>("[data-dict-input='forceTo']")!;
    nextFrom.value = "视频";
    nextTo.value = "影片";
    nextTo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(updateSettings).toHaveBeenCalledTimes(2);
  });

  it("原词或替换词为空时不提交", async () => {
    await showSettingsView();
    body().querySelector<HTMLButtonElement>("[data-dict-action='addForceRule']")!.click();
    await flush();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("点击删除强制替换规则", async () => {
    getSettingsMock.mockResolvedValue(
      buildSettings({
        userDictionary: {
          forceReplaceRules: [
            { id: "rule-1", variant: "zh-TW", from: "视频", to: "影片", enabled: true },
          ],
        },
      }),
    );
    await showSettingsView();
    body().querySelector<HTMLButtonElement>("[data-dict-action='openDictList']")!.click();
    body().querySelector<HTMLButtonElement>("[data-dict-action='removeForceRule']")!.click();
    await flush();

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        userDictionary: expect.objectContaining({ forceReplaceRules: [] }),
      }),
    );
  });
});

describe("快捷键录制", () => {
  function getRow(): HTMLElement {
    return body().querySelector<HTMLElement>("[data-action='toggleEnabled']")!;
  }

  async function startRecording(): Promise<HTMLInputElement> {
    await showSettingsView();
    body()
      .querySelector<HTMLButtonElement>("[data-action='toggleEnabled'][data-shortcut-action='record']")!
      .click();
    return body().querySelector<HTMLInputElement>(".cvl-settings-sc-input")!;
  }

  it("点击编辑进入录制状态并聚焦输入框", async () => {
    const input = await startRecording();
    expect(getRow().dataset.recording).toBe("true");
    expect(document.activeElement).toBe(input);
  });

  it("录制时按键回显组合键，确认后保存", async () => {
    const input = await startRecording();
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, altKey: true, bubbles: true }),
    );
    expect(input.value).toBe("Ctrl + Alt + K");

    body().querySelector<HTMLButtonElement>(".cvl-settings-sc-confirm")!.click();
    await flush();

    expect(updateSettings).toHaveBeenCalledWith({
      shortcuts: { toggleEnabled: { ctrl: true, meta: false, alt: true, shift: false, key: "K" } },
    });
    expect(getRow().dataset.recording).toBeUndefined();
  });

  it("只按修饰键不记录", async () => {
    const input = await startRecording();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }));
    expect(input.value).toBe("");
  });

  it("没有捕获组合键时确认取消录制", async () => {
    await startRecording();
    body().querySelector<HTMLButtonElement>(".cvl-settings-sc-confirm")!.click();
    await flush();

    expect(updateSettings).not.toHaveBeenCalled();
    expect(getRow().dataset.recording).toBeUndefined();
  });

  it("取消按钮退出录制", async () => {
    await startRecording();
    body().querySelector<HTMLButtonElement>(".cvl-settings-sc-cancel")!.click();

    expect(getRow().dataset.recording).toBeUndefined();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("录制中按 Esc 取消录制而非返回", async () => {
    await startRecording();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(getRow().dataset.recording).toBeUndefined();
    expect(showReviewView).not.toHaveBeenCalled();
  });

  it("取消录制后恢复显示原组合键", async () => {
    await startRecording();
    body().querySelector<HTMLButtonElement>(".cvl-settings-sc-cancel")!.click();

    expect(body().querySelector(".cvl-settings-sc-key")?.textContent).toBe("Ctrl + Shift + U");
  });
});
