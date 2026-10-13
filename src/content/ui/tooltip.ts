import {
    TOOLTIP_ARROW_CLASS,
    TOOLTIP_BODY_CLASS,
    TOOLTIP_ID,
} from "./styles";

let tooltipEl: HTMLDivElement | null = null;
let hideTimer: number | null = null;

function clearHideTimer(): void {
    if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
}

function ensureTooltip(): HTMLDivElement {
    if (tooltipEl) {
        return tooltipEl;
    }

    tooltipEl = document.createElement("div");
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.dataset.hidden = "true";
    tooltipEl.dataset.visible = "false";
    tooltipEl.innerHTML = `
    <div class="${TOOLTIP_BODY_CLASS}"></div>
    <div class="${TOOLTIP_ARROW_CLASS}" aria-hidden="true"></div>
  `;
    document.documentElement.append(tooltipEl);
    return tooltipEl;
}

export function hideTooltip(immediate = false): void {
    clearHideTimer();
    const tip = ensureTooltip();
    if (immediate) {
        tip.dataset.hidden = "true";
        tip.dataset.visible = "false";
        return;
    }
    hideTimer = window.setTimeout(() => {
        tip.dataset.hidden = "true";
        tip.dataset.visible = "false";
    }, 80);
}

export function showTooltip(anchor: HTMLElement): void {
    const message = anchor.dataset.tooltip;
    if (!message) {
        return;
    }

    clearHideTimer();
    const tip = ensureTooltip();
    const body = tip.querySelector<HTMLElement>(`.${TOOLTIP_BODY_CLASS}`);
    if (!body) {
        return;
    }

    body.textContent = message;
    tip.style.width = "";
    tip.dataset.hidden = "false";
    tip.dataset.visible = "false";

    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    const centerX = anchorRect.left + anchorRect.width / 2;

    const placeBelow = anchorRect.bottom + tipRect.height + gap <= window.innerHeight - margin;
    const top = placeBelow
        ? anchorRect.bottom + gap
        : anchorRect.top - tipRect.height - gap;

    const left = Math.min(
        Math.max(centerX - tipRect.width / 2, margin),
        window.innerWidth - tipRect.width - margin,
    );
    const arrowOffset = Math.max(
        16,
        Math.min(centerX - left, tipRect.width - 16),
    );

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.width = `${tipRect.width}px`;
    tip.style.setProperty("--cvl-tooltip-arrow-left", `${arrowOffset}px`);
    tip.dataset.placement = placeBelow ? "bottom" : "top";
    tip.dataset.visible = "true";
}

/** 为图标按钮绑定自定义 tooltip（替代原生 title）。 */
export function attachTooltip(button: HTMLElement): void {
    button.addEventListener("mouseenter", () => showTooltip(button));
    button.addEventListener("mouseleave", () => hideTooltip());
    button.addEventListener("focusin", () => showTooltip(button));
    button.addEventListener("focusout", () => hideTooltip(true));
}
