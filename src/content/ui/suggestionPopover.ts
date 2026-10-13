import { canReplaceIssue } from "../../core/apply";
import { escapeHtml } from "../../shared/dom";
import { t } from "../../shared/locale";
import { measureIssueRects, type RectLike } from "../geometry/rects";
import { findIssueById, state } from "../state";
import { updateActiveMarkState } from "./markLayer";
import { HIDE_DELAY_MS, POPOVER_ID } from "./styles";

let suggestionPopover: HTMLDivElement | null = null;
let hidePopoverTimer: number | null = null;

// 缓存上一次定位时的标注位置信息，用于避免不必要的 DOM 更新
let lastPositionedRect: { left: number; top: number; width: number; height: number } | null = null;

export function ensureSuggestionPopover(): HTMLDivElement {
    if (suggestionPopover) {
        return suggestionPopover;
    }

    suggestionPopover = document.createElement("div");
    suggestionPopover.id = POPOVER_ID;
    suggestionPopover.dataset.hidden = "true";
    suggestionPopover.addEventListener("mouseenter", cancelHideSuggestionPopover);
    suggestionPopover.addEventListener("mouseleave", scheduleHideSuggestionPopover);
    document.documentElement.append(suggestionPopover);
    return suggestionPopover;
}

export function hideSuggestionPopover(): void {
    state.popoverIssueId = null;
    ensureSuggestionPopover().dataset.hidden = "true";
    updateActiveMarkState();
}

export function hideSuggestionPopoverOnly(): void {
    ensureSuggestionPopover().dataset.hidden = "true";
}

export function cancelHideSuggestionPopover(): void {
    if (hidePopoverTimer) {
        window.clearTimeout(hidePopoverTimer);
        hidePopoverTimer = null;
    }
}

export function scheduleHideSuggestionPopover(): void {
    cancelHideSuggestionPopover();
    hidePopoverTimer = window.setTimeout(() => {
        hideSuggestionPopover();
    }, HIDE_DELAY_MS);
}

export function positionSuggestionPopover(anchorRect: RectLike, forceUpdate = false): void {
    const popover = ensureSuggestionPopover();
    const margin = 12;
    const popoverRect = popover.getBoundingClientRect();
    let left = anchorRect.left;
    let top = anchorRect.bottom + 4;

    if (left + popoverRect.width > window.innerWidth - margin) {
        left = window.innerWidth - popoverRect.width - margin;
    }

    if (left < margin) {
        left = margin;
    }

    if (top + popoverRect.height > window.innerHeight - margin) {
        top = anchorRect.top - popoverRect.height - 4;
    }

    if (top < margin) {
        top = margin;
    }

    // 如果不是强制更新，且位置没有变化，则跳过更新
    // 利用 position: absolute 的特性：元素会自动跟随文档滚动
    if (!forceUpdate && lastPositionedRect &&
        lastPositionedRect.left === anchorRect.left &&
        lastPositionedRect.top === anchorRect.top &&
        lastPositionedRect.width === anchorRect.width &&
        lastPositionedRect.height === anchorRect.height) {
        return; // 位置未变，避免不必要的 reflow
    }

    // 转为文档坐标（视口坐标 + 滚动偏移），使浮层随页面/文本框滚动，
    // 而非固定在视口导致滚动时与标注脱离。
    const newLeft = `${left + window.scrollX}px`;
    const newTop = `${top + window.scrollY}px`;

    // 只有值真的变了才更新 DOM（智能检测）
    if (popover.style.left !== newLeft || popover.style.top !== newTop) {
        popover.style.left = newLeft;
        popover.style.top = newTop;
    }

    // 缓存当前位置
    lastPositionedRect = { left: anchorRect.left, top: anchorRect.top, width: anchorRect.width, height: anchorRect.height };
}

/**
 * 文本框内部滚动时，标注会被重新测量；此处让浮层重新贴合当前标注矩形。
 * 页面级滚动无需调用，absolute 定位会随文档原生滚动。
 */
export function repositionSuggestionPopover(): void {
    const popover = ensureSuggestionPopover();
    if (popover.dataset.hidden === "true" || !state.popoverIssueId) {
        return;
    }
    const issue = findIssueById(state.popoverIssueId);
    // 实时测量，避免使用滚动/缩放后过时的缓存矩形
    let anchorRect: RectLike | null = null;
    if (issue && state.activeElement) {
        const rects = measureIssueRects(state.activeElement, issue);
        anchorRect = rects.length > 0 ? rects[0] : null;
    }
    if (!anchorRect) {
        hideSuggestionPopover();
        lastPositionedRect = null;
        return;
    }
    positionSuggestionPopover(anchorRect, true); // 标注位置可能变化，强制更新
}

export function renderSuggestionPopover(issueId: string): void {
    const issue = findIssueById(issueId);
    // 实时测量标注矩形，避免使用 issueRectMap 中滚动后过时的视口坐标；
    // 否则浮层会按「旧视口位置 + 当前滚动偏移」定位，与原词产生偏移。
    let anchorRect: RectLike | null = null;
    if (issue && state.activeElement) {
        const rects = measureIssueRects(state.activeElement, issue);
        anchorRect = rects.length > 0 ? rects[0] : null;
    }
    if (!issue || !anchorRect) {
        hideSuggestionPopover();
        return;
    }

    const popover = ensureSuggestionPopover();
    const suggestion = issue.suggestions.find((item) => item.isDefault) ?? issue.suggestions[0];
    const replaceDisabled = !state.activeElement || !canReplaceIssue(state.activeElement);
    const helper = replaceDisabled ? `<div class="cvl-popover-warning">${t("popover.noReplace")}</div>` : "";

    state.popoverIssueId = issueId;
    updateActiveMarkState();
    popover.dataset.hidden = "false";
    popover.innerHTML = `
    <div class="cvl-popover-message">${escapeHtml(issue.message)}</div>
    ${helper}
    <div class="cvl-popover-actions">
      <button class="cvl-popover-button cvl-popover-button-primary" type="button" data-action="replace" ${replaceDisabled ? "disabled" : ""}>
        <strong>${escapeHtml(suggestion?.value ?? issue.sourceText)}</strong>
      </button>
      <button class="cvl-popover-button" type="button" data-action="allow" aria-label="${t("review.aria.allow")}" title="${t("review.aria.allow")}">${t("popover.allow")}</button>
      <button class="cvl-popover-button" type="button" data-action="ignore">${t("popover.ignore")}</button>
    </div>
  `;
    positionSuggestionPopover(anchorRect, true); // 状态变化时强制更新

    popover.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
            const actions = state.actions;
            if (!actions) {
                return;
            }

            switch (button.dataset.action) {
                case "replace":
                    await actions.replace(issue);
                    return;
                case "allow":
                    await actions.allow(issue);
                    return;
                case "ignore":
                    await actions.ignore(issue);
                    return;
                default:
                    return;
            }
        });
    });
}
