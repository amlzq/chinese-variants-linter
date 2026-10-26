import { escapeHtml } from "../../shared/dom";
import { measureIssueRects } from "../geometry/rects";
import { findIssueById, state } from "../state";
import { updateLauncher } from "./cvlLauncher";
import { goToIssue, isReviewViewOpen } from "./reviewView";
import { isSettingsViewOpen } from "./settingsView";
import { LAYER_ID } from "./styles";
import { cancelHideSuggestionPopover, hideSuggestionPopover, hideSuggestionPopoverOnly, renderSuggestionPopover, scheduleHideSuggestionPopover } from "./suggestionPopover";

let markLayer: HTMLDivElement | null = null;

// 上一次完整渲染时活跃元素的内部滚动位置，以及此后累计的滚动位移。
// 文本框内部滚动时，先用 transform 平移整个标注内容（同步、无需重新测量），
// 随后再由完整重绘校正，避免快速滚动时下划线滞后。
let renderedScroll = { left: 0, top: 0 };
let scrollOffset = { x: 0, y: 0 };

function getMarkContent(): HTMLElement | null {
    return markLayer?.querySelector<HTMLElement>(".cvl-mark-content") ?? null;
}

/** 活跃元素内部滚动时同步平移已渲染的标注，使其紧跟文字。 */
export function syncMarksToElementScroll(): void {
    const element = state.activeElement;
    const content = getMarkContent();
    if (!element || !content) {
        return;
    }

    scrollOffset = {
        x: element.scrollLeft - renderedScroll.left,
        y: element.scrollTop - renderedScroll.top,
    };
    content.style.transform = `translate(${-scrollOffset.x}px, ${-scrollOffset.y}px)`;
}

/** 把标注层裁剪到活跃元素的盒子内，换行或滚出的下划线不会画到输入框之外。 */
function clipLayerToElement(layer: HTMLElement, element: Element): void {
    const box = element.getBoundingClientRect();
    if (box.right <= box.left || box.bottom <= box.top) {
        layer.style.clipPath = "";
        return;
    }

    const left = box.left + window.scrollX;
    const right = box.right + window.scrollX;
    const top = box.top + window.scrollY;
    const bottom = box.bottom + window.scrollY;
    layer.style.clipPath = `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
}

export function ensureMarkLayer(): HTMLDivElement {
    if (markLayer) {
        return markLayer;
    }

    markLayer = document.createElement("div");
    markLayer.id = LAYER_ID;
    markLayer.dataset.hidden = "true";
    document.documentElement.append(markLayer);
    return markLayer;
}

export function updateActiveMarkState(): void {
    const layer = ensureMarkLayer();
    layer.querySelectorAll<HTMLElement>(".cvl-mark").forEach((node) => {
        node.dataset.active = node.dataset.issueId === state.popoverIssueId ? "true" : "false";
    });
    layer.querySelectorAll(".cvl-mark-highlight").forEach((node) => {
        node.remove();
    });

    if (!state.popoverIssueId || !state.activeElement) {
        return;
    }

    const issue = findIssueById(state.popoverIssueId);
    if (!issue) {
        return;
    }

    // 实时测量当前 issue 的位置，避免使用过时的缓存数据
    // 这解决了 textarea 内部滚动或页面滚动后背景高亮位置错乱的问题
    const rects = measureIssueRects(state.activeElement, issue);
    if (rects.length === 0) {
        return;
    }

    const highlightMarkup = rects
        .map((rect) => {
            // 标注内容已按 scrollOffset 平移，此处换算回内容坐标系。
            const left = Math.max(rect.left - 2, 0) + window.scrollX + scrollOffset.x;
            const top = Math.max(rect.top + 1, 0) + window.scrollY + scrollOffset.y;
            const width = rect.width + 4;
            const height = Math.max(rect.height - 3, 10);
            return `
        <div
          class="cvl-mark-highlight"
          data-confidence="${issue.confidence}"
          style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"
        ></div>
      `;
        })
        .join("");

    (getMarkContent() ?? layer).insertAdjacentHTML("afterbegin", highlightMarkup);
}

function isRectInsideViewport(
    rect: { left: number; right: number; top: number; bottom: number },
    viewport: { left: number; right: number; top: number; bottom: number },
): boolean {
    // 无布局盒（如 display 异常或测试环境）时不裁剪。
    if (viewport.right <= viewport.left || viewport.bottom <= viewport.top) {
        return true;
    }

    return (
        rect.bottom > viewport.top &&
        rect.top < viewport.bottom &&
        rect.right > viewport.left &&
        rect.left < viewport.right
    );
}

export function clearIssueMarks(): void {
    state.issueRectMap.clear();
    ensureMarkLayer().innerHTML = "";
    ensureMarkLayer().dataset.hidden = "true";
    scrollOffset = { x: 0, y: 0 };
    hideSuggestionPopover();
}

export function renderMarks(): void {
    const layer = ensureMarkLayer();

    // 设置视图可见时，隐藏正文中的所有检测标记。
    if (isSettingsViewOpen()) {
        clearIssueMarks();
        return;
    }

    state.issueRectMap.clear();
    layer.innerHTML = "";
    scrollOffset = { x: 0, y: 0 };

    if (!state.activeElement || state.activeIssues.length === 0) {
        layer.dataset.hidden = "true";
        hideSuggestionPopover();
        updateLauncher();
        return;
    }

    // 文本框内部滚动后，已滚出可视区域的文字不应再显示下划线。
    const viewport = state.activeElement.getBoundingClientRect();
    renderedScroll = { left: state.activeElement.scrollLeft, top: state.activeElement.scrollTop };
    clipLayerToElement(layer, state.activeElement);
    const fragments: string[] = [];
    for (const issue of state.activeIssues) {
        const rects = measureIssueRects(state.activeElement, issue).filter((rect) =>
            isRectInsideViewport(rect, viewport),
        );
        if (rects.length === 0) {
            continue;
        }

        state.issueRectMap.set(issue.id, rects);
        rects.forEach((rect) => {
            // 转为文档坐标，使下划线随页面（文本框）滚动，而非固定在视口。
            const docLeft = rect.left + window.scrollX;
            const docTop = rect.top + window.scrollY;
            const underlineTop = Math.max(rect.bottom - 4, rect.top) + window.scrollY;
            fragments.push(`
        <button
          class="cvl-mark"
          type="button"
          aria-label="${escapeHtml(issue.message)}"
          data-issue-id="${issue.id}"
          data-confidence="${issue.confidence}"
          data-active="${state.popoverIssueId === issue.id ? "true" : "false"}"
          style="left:${docLeft}px;top:${underlineTop}px;width:${Math.max(rect.width, 8)}px;height:8px;"
        ></button>
      `);
        });
    }

    layer.innerHTML = `<div class="cvl-mark-content">${fragments.join("")}</div>`;
    layer.dataset.hidden = state.issueRectMap.size === 0 ? "true" : "false";

    layer.querySelectorAll<HTMLButtonElement>(".cvl-mark").forEach((button) => {
        button.addEventListener("mouseenter", () => {
            cancelHideSuggestionPopover();
            if (isReviewViewOpen()) {
                return;
            }
            const issueId = button.dataset.issueId;
            if (issueId) {
                renderSuggestionPopover(issueId);
            }
        });

        button.addEventListener("mouseleave", scheduleHideSuggestionPopover);

        // 点击「原词下划线」：与 reviewView 联动，同步切换到对应索引页。
        button.addEventListener("click", () => {
            const issueId = button.dataset.issueId;
            if (issueId) {
                goToIssue(issueId);
            }
        });
    });

    if (isReviewViewOpen()) {
        hideSuggestionPopoverOnly();
    } else if (state.popoverIssueId && state.issueRectMap.has(state.popoverIssueId)) {
        renderSuggestionPopover(state.popoverIssueId);
    } else if (state.popoverIssueId) {
        hideSuggestionPopover();
    }

    // 重绘后重新应用当前 issue 的背景高亮，确保与 reviewView 索引页保持同步。
    if (state.popoverIssueId) {
        updateActiveMarkState();
    }

    updateLauncher();
}
