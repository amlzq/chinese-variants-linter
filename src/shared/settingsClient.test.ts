import { afterEach, describe, expect, it, vi } from "vitest";
import { toggleSite, updateSettings } from "./settingsClient";

function stubSendMessage(result: unknown = { ok: true }) {
  const sendMessage = vi.fn(async () => result);
  vi.stubGlobal("browser", { runtime: { sendMessage } });
  return sendMessage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settingsClient", () => {
  it("updateSettings 通过后台消息写入补丁", async () => {
    const sendMessage = stubSendMessage();
    const patch = { enabled: false };
    await updateSettings(patch);

    expect(sendMessage).toHaveBeenCalledWith({ type: "settings/update", patch });
  });

  it("toggleSite 通过后台消息切换站点开关", async () => {
    const sendMessage = stubSendMessage();
    await toggleSite("example.com", false);

    expect(sendMessage).toHaveBeenCalledWith({
      type: "site/toggle",
      hostname: "example.com",
      enabled: false,
    });
  });

  it("透传后台返回的设置", async () => {
    const result = { enabled: true };
    stubSendMessage(result);
    await expect(updateSettings({ enabled: true })).resolves.toBe(result);
  });
});
