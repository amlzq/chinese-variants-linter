import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeMessage } from "../src/shared/messages";
import { DEFAULT_SETTINGS } from "../src/core/storage";

type Listener = (
  message: RuntimeMessage,
  sender: { id: string },
) => unknown;

function setupBackground() {
  const listeners: Listener[] = [];
  const store = new Map<string, unknown>();
  const sendResponse = vi.fn();

  vi.stubGlobal("browser", {
    runtime: {
      id: "self-id",
      onMessage: {
        addListener: (listener: Listener) => listeners.push(listener),
      },
    },
    tabs: {
      query: vi.fn(async () => [{ url: "https://example.com/page" }]),
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
    },
  });

  const defineBackground = vi.fn((callback: () => void) => callback());
  vi.stubGlobal("defineBackground", defineBackground);

  return { listeners, defineBackground, store, sendResponse };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("background 消息处理", () => {
  it("注册 background 入口", async () => {
    const { defineBackground } = setupBackground();
    await import("./background");
    expect(defineBackground).toHaveBeenCalledTimes(1);
  });

  it("拒绝来自非本扩展上下文的消息", async () => {
    const { listeners } = setupBackground();
    await import("./background");
    const handler = listeners[0]!;

    expect(handler({ type: "settings/update", patch: {} }, { id: "other-id" })).toBeUndefined();
  });

  it("忽略缺少 type 的消息", async () => {
    const { listeners } = setupBackground();
    await import("./background");
    const handler = listeners[0]!;

    expect(handler({} as RuntimeMessage, { id: "self-id" })).toBeUndefined();
  });

  it("popup/get-state 返回设置、站点与开关状态", async () => {
    const { listeners } = setupBackground();
    await import("./background");
    const handler = listeners[0]!;

    const result = (await handler({ type: "popup/get-state" }, { id: "self-id" })) as {
      settings: typeof DEFAULT_SETTINGS;
      hostname: string | null;
      siteEnabled: boolean;
    };

    expect(result.hostname).toBe("example.com");
    expect(result.siteEnabled).toBe(true);
    expect(result.settings.enabled).toBe(true);
  });

  it("settings/update 合并并持久化补丁", async () => {
    const { listeners, store } = setupBackground();
    await import("./background");
    const handler = listeners[0]!;

    const result = (await handler(
      { type: "settings/update", patch: { detectionLevel: "relaxed" } },
      { id: "self-id" },
    )) as { detectionLevel: string };

    expect(result.detectionLevel).toBe("relaxed");
    expect(store.get("extension-settings")).toMatchObject({ detectionLevel: "relaxed" });
  });

  it("site/toggle 记录站点开关", async () => {
    const { listeners } = setupBackground();
    await import("./background");
    const handler = listeners[0]!;

    const result = (await handler(
      { type: "site/toggle", hostname: "example.com", enabled: false },
      { id: "self-id" },
    )) as { siteEnabledMap: Record<string, boolean> };

    expect(result.siteEnabledMap["example.com"]).toBe(false);
  });

  it("未知消息类型返回 undefined", async () => {
    const { listeners } = setupBackground();
    await import("./background");
    const handler = listeners[0]!;

    expect(
      handler({ type: "unknown/type" } as unknown as RuntimeMessage, { id: "self-id" }),
    ).toBeUndefined();
  });
});
