import { afterEach, describe, expect, it, vi } from "vitest";
import { TOOLTIP_ID } from "./styles";
import { attachTooltip, hideTooltip, showTooltip } from "./tooltip";

afterEach(() => {
  vi.useRealTimers();
  // tooltip 元素在模块内缓存，测试间保留 DOM 节点，仅重置状态并清理定时器。
  hideTooltip(true);
});

function createAnchor(tooltip?: string): HTMLButtonElement {
  const anchor = document.createElement("button");
  if (tooltip !== undefined) {
    anchor.dataset.tooltip = tooltip;
  }
  document.body.append(anchor);
  return anchor;
}

describe("showTooltip", () => {
  it("展示带 tooltip 文案的锚点", () => {
    const anchor = createAnchor("提示内容");
    showTooltip(anchor);

    const tip = document.getElementById(TOOLTIP_ID)!;
    expect(tip.dataset.hidden).toBe("false");
    expect(tip.dataset.visible).toBe("true");
    expect(tip.querySelector(".cvl-tooltip-body")?.textContent).toBe("提示内容");
    expect(tip.dataset.placement).toBe("bottom");
  });

  it("多个锚点复用同一个浮层", () => {
    showTooltip(createAnchor("一"));
    showTooltip(createAnchor("二"));
    expect(document.querySelectorAll(`#${TOOLTIP_ID}`).length).toBe(1);
  });

  it("锚点没有文案时保持隐藏", () => {
    showTooltip(createAnchor());
    expect(document.getElementById(TOOLTIP_ID)?.dataset.visible).not.toBe("true");
  });

  it("接近视口底部时改为上方展示", () => {
    const anchor = createAnchor("提示");
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      left: 200,
      top: 740,
      right: 240,
      bottom: 760,
      width: 40,
      height: 20,
    } as DOMRect);

    showTooltip(anchor);
    const tip = document.getElementById(TOOLTIP_ID)!;
    expect(tip.dataset.placement).toBe("top");
    expect(parseFloat(tip.style.top)).toBe(740 - 0 - 10);
  });

  it("靠右锚点会被限制在视口内", () => {
    const anchor = createAnchor("提示");
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      left: 1010,
      top: 10,
      right: 1020,
      bottom: 30,
      width: 10,
      height: 20,
    } as DOMRect);

    showTooltip(anchor);
    const tip = document.getElementById(TOOLTIP_ID)!;
    expect(parseFloat(tip.style.left)).toBe(1024 - 0 - 12);
  });
});

describe("hideTooltip", () => {
  it("立即隐藏", () => {
    const anchor = createAnchor("提示");
    showTooltip(anchor);
    hideTooltip(true);

    const tip = document.getElementById(TOOLTIP_ID)!;
    expect(tip.dataset.hidden).toBe("true");
    expect(tip.dataset.visible).toBe("false");
  });

  it("延迟 80ms 隐藏", () => {
    vi.useFakeTimers();
    const anchor = createAnchor("提示");
    showTooltip(anchor);
    hideTooltip();

    const tip = document.getElementById(TOOLTIP_ID)!;
    expect(tip.dataset.hidden).toBe("false");
    vi.advanceTimersByTime(80);
    expect(tip.dataset.hidden).toBe("true");
  });

  it("再次展示会取消待执行的隐藏", () => {
    vi.useFakeTimers();
    const anchor = createAnchor("提示");
    showTooltip(anchor);
    hideTooltip();
    showTooltip(anchor);
    vi.advanceTimersByTime(80);

    expect(document.getElementById(TOOLTIP_ID)!.dataset.hidden).toBe("false");
  });
});

describe("attachTooltip", () => {
  it("hover / focus 时展示，离开时隐藏", () => {
    vi.useFakeTimers();
    const anchor = createAnchor("提示");
    attachTooltip(anchor);

    anchor.dispatchEvent(new Event("mouseenter"));
    expect(document.getElementById(TOOLTIP_ID)!.dataset.visible).toBe("true");

    anchor.dispatchEvent(new Event("mouseleave"));
    vi.advanceTimersByTime(80);
    expect(document.getElementById(TOOLTIP_ID)!.dataset.hidden).toBe("true");

    anchor.dispatchEvent(new Event("focusin"));
    expect(document.getElementById(TOOLTIP_ID)!.dataset.visible).toBe("true");

    anchor.dispatchEvent(new Event("focusout"));
    expect(document.getElementById(TOOLTIP_ID)!.dataset.hidden).toBe("true");
  });
});
