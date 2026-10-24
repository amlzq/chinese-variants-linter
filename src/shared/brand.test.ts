import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAND_ICON_PATH } from "./brand";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("getBrandIconUrl", () => {
  it("通过 runtime.getURL 解析扩展内地址", async () => {
    const getURL = vi.fn(() => "moz-extension://abc/icon.svg");
    vi.stubGlobal("browser", { runtime: { getURL } });

    const { getBrandIconUrl } = await import("./brand");
    expect(getBrandIconUrl()).toBe("moz-extension://abc/icon.svg");
    expect(getURL).toHaveBeenCalledWith(BRAND_ICON_PATH);
  });

  it("重复调用只解析一次（模块级缓存）", async () => {
    const getURL = vi.fn(() => "chrome-extension://abc/icon.svg");
    vi.stubGlobal("browser", { runtime: { getURL } });

    const { getBrandIconUrl } = await import("./brand");
    getBrandIconUrl();
    getBrandIconUrl();
    expect(getURL).toHaveBeenCalledTimes(1);
  });
});
