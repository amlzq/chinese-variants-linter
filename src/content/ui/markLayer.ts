import { escapeHtml } from "../../shared/dom";
import { measureIssueRects } from "../geometry/rects";
import { findIssueById, state } from "../state";
import { updateLauncher } from "./cvlLauncher";
import { goToIssue, isReviewViewOpen } from "./reviewView";
import { isSettingsViewOpen } from "./settingsView";
import { LAYER_ID } from "./styles";
import { cancelHideSuggestionPopover, hideSuggestionPopover, hideSuggestionPopoverOnly, renderSuggestionPopover, scheduleHideSuggestionPopover } from "./suggestionPopover";

let markLayer: HTMLDivElement | null = null;

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
            const left = Math.max(rect.left - 2, 0) + window.scrollX;
            const top = Math.max(rect.top + 1, 0) + window.scrollY;
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

    layer.insertAdjacentHTML("afterbegin", highlightMarkup);
}

export function clearIssueMarks(): void {
    state.issueRectMap.clear();
    ensureMarkLayer().innerHTML = "";
    ensureMarkLayer().dataset.hidden = "true";
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

    if (!state.activeElement || state.activeIssues.length === 0) {
        layer.dataset.hidden = "true";
        hideSuggestionPopover();
        updateLauncher();
        return;
    }

    const fragments: string[] = [];
    for (const issue of state.activeIssues) {
        const rects = measureIssueRects(state.activeElement, issue);
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

    layer.innerHTML = fragments.join("");
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
