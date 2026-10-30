import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../../core/storage";
import { bindDictPageEvents, getDictPageMarkup } from "./dictView";

const settings = mergeSettings(DEFAULT_SETTINGS, {
  defaultVariant: "zh-TW",
  userDictionary: {
    forceReplaceRules: [
      { id: "rule-1", variant: "zh-TW", from: "视频", to: "影片", enabled: true },
    ],
  },
});

function mount(html: string): HTMLElement {
  const body = document.createElement("div");
  body.innerHTML = html;
  return body;
}

describe("getDictPageMarkup", () => {
  it("渲染用户添加的替换规则", () => {
    const body = mount(getDictPageMarkup(settings));
    expect(body.querySelector(".cvl-settings-rule-from")?.textContent).toBe("视频");
    expect(body.querySelector(".cvl-settings-rule-to")?.textContent).toBe("影片");
  });

  it("没有规则时展示占位文案", () => {
    const body = mount(getDictPageMarkup(DEFAULT_SETTINGS));
    expect(body.querySelector(".cvl-settings-empty")).not.toBeNull();
    expect(body.querySelector("[data-dict-action='removeForceRule']")).toBeNull();
  });

  it("转义规则文本", () => {
    const evil = mergeSettings(DEFAULT_SETTINGS, {
      userDictionary: {
        forceReplaceRules: [
          { id: "x", variant: "zh-TW", from: "<b>a</b>", to: "b", enabled: true },
        ],
      },
    });
    const body = mount(getDictPageMarkup(evil));
    expect(body.querySelector("b")).toBeNull();
  });
});

describe("bindDictPageEvents", () => {
  it("点击删除提交移除该规则的补丁", async () => {
    const body = mount(getDictPageMarkup(settings));
    const update = vi.fn(async () => {});
    bindDictPageEvents(body, () => settings, update);

    body.querySelector<HTMLButtonElement>("[data-dict-action='removeForceRule']")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        userDictionary: expect.objectContaining({ forceReplaceRules: [] }),
      }),
    );
  });
});
