import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, STORAGE_KEY } from "../../src/core/storage";
import { state } from "../../src/content/state";
import { LAUNCHER_ID, LAYER_ID, STYLE_ID } from "../../src/content/ui/styles";
import type { ExtensionSettings } from "../../src/shared/types";

const store = new Map<string, unknown>();
const changeListeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function emitSettingsChange(next: ExtensionSettings): void {
  store.set(STORAGE_KEY, next);
  for (const listener of changeListeners) {
    listener({ [STORAGE_KEY]: { newValue: next } }, "local");
  }
}

function hasExtensionNodes(): boolean {
  return [STYLE_ID, LAYER_ID, LAUNCHER_ID].some((id) => document.getElementById(id) !== null);
}

beforeAll(async () => {
  // 站点开关默认关闭。
  store.set(STORAGE_KEY, mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW" }));

  vi.stubGlobal("browser", {
    runtime: { sendMessage: vi.fn(async () => store.get(STORAGE_KEY)) },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
        set: vi.fn(async () => undefined),
      },
      onChanged: {
        addListener: (listener: (changes: Record<string, unknown>, area: string) => void) => {
          changeListeners.push(listener);
        },
      },
    },
  });

  vi.stubGlobal("defineContentScript", (config: { main: () => Promise<void> }) => config);
  const module = await import("../../entrypoints/content");
  await (module.default as unknown as { main: () => Promise<void> }).main();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("未开启检查的站点", () => {
  it("不向页面插入扩展节点，也不响应编辑区事件", () => {
    expect(hasExtensionNodes()).toBe(false);

    const textarea = document.createElement("textarea");
    textarea.value = "软件";
    document.body.append(textarea);
    textarea.focus();
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(state.activeElement).toBeNull();
    expect(hasExtensionNodes()).toBe(false);
  });

  it("开启站点后创建 UI，并接管已聚焦的编辑区", async () => {
    emitSettingsChange(
      mergeSettings(DEFAULT_SETTINGS, {
        defaultVariant: "zh-TW",
        siteEnabledMap: { [location.hostname]: true },
      }),
    );
    await flush();

    expect(hasExtensionNodes()).toBe(true);
    expect(state.activeElement).toBe(document.activeElement);
  });

  it("UI 已创建后再关闭站点：聚焦输入框不闪现启动器", async () => {
    emitSettingsChange(
      mergeSettings(DEFAULT_SETTINGS, {
        defaultVariant: "zh-TW",
        siteEnabledMap: { [location.hostname]: false },
      }),
    );
    await flush();

    const launcher = document.getElementById(LAUNCHER_ID)!;
    expect(launcher.dataset.hidden).toBe("true");

    const textarea = document.createElement("textarea");
    textarea.value = "软件";
    document.body.append(textarea);
    textarea.focus();
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // 聚焦后立即（早于 300ms 检测定时器）启动器仍须保持隐藏，且不进入编辑态。
    expect(launcher.dataset.hidden).toBe("true");
    expect(launcher.dataset.state).not.toBe("editing");

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(launcher.dataset.hidden).toBe("true");
    expect(launcher.dataset.state).not.toBe("editing");
  });
});
