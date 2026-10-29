import { canReplaceIssue, getEditableText } from "../../core/apply";
import { getBrandIconUrl } from "../../shared/brand";
import { escapeHtml } from "../../shared/dom";
import { t } from "../../shared/locale";
import type { Issue } from "../../shared/types";
import { getSelectionOffsets } from "../geometry/rects";
import { findIssueById, getPrimaryRect, state } from "../state";
import { computeContextSpan } from "./contextClip";
import { ensureMainPanel, getMainPanelView, hideReviewView, isMainPanelOpen, openSettings, showMainPanel } from "./mainPanel";
import { updateActiveMarkState } from "./markLayer";
import { REVIEW_VIEW_ID } from "./styles";
import { attachTooltip, hideTooltip } from "./tooltip";

let reviewView: HTMLDivElement | null = null;
let currentIndex = 0;

export function ensureReviewView(): HTMLDivElement {
  if (reviewView) {
    return reviewView;
  }

  reviewView = document.createElement("div");
  reviewView.id = REVIEW_VIEW_ID;
  // The view lives inside #cvl-main-panel, which manages visibility/position.
  return reviewView;
}

export function isReviewViewOpen(): boolean {
  return isMainPanelOpen() && getMainPanelView() === "review";
}

function getLogoMarkup(): string {
  // 与工具栏共用同一份品牌图标（src/assets/brand-icon.svg），改一处全局生效。
  return `<img class="cvl-review-logo" src="${getBrandIconUrl()}" alt="" aria-hidden="true" />`;
}

function getSettingsIconMarkup(): string {
  return `
    <svg class="cvl-review-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  `;
}

function getCloseIconMarkup(): string {
  return `
    <svg class="cvl-review-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
}

function getChevronRightMarkup(): string {
  return `
    <svg class="cvl-review-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  `;
}

function getChevronLeftMarkup(): string {
  return `
    <svg class="cvl-review-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  `;
}

function getCategoryIconMarkup(): string {
  return `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z"/>
    </svg>
  `;
}

function getDictionaryIconMarkup(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  `;
}

function getEmptyIconMarkup(): string {
  return `
    <svg class="cvl-review-empty-icon" viewBox="0 7 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- 卷轴主体 -->
      <rect x="28" y="30" width="64" height="50" rx="4" fill="#FEF3C7" stroke="#D97706" stroke-width="2.5"/>
      <line x1="40" y1="44" x2="80" y2="44" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
      <line x1="40" y1="54" x2="72" y2="54" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
      <line x1="40" y1="64" x2="64" y2="64" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
      <!-- 左卷轴头 -->
      <ellipse cx="24" cy="38" rx="6" ry="10" fill="#FDE68A" stroke="#D97706" stroke-width="2"/>
      <ellipse cx="24" cy="72" rx="6" ry="10" fill="#FDE68A" stroke="#D97706" stroke-width="2"/>
      <!-- 右卷轴头 -->
      <ellipse cx="96" cy="38" rx="6" ry="10" fill="#FDE68A" stroke="#D97706" stroke-width="2"/>
      <ellipse cx="96" cy="72" rx="6" ry="10" fill="#FDE68A" stroke="#D97706" stroke-width="2"/>
      <!-- 徽章 -->
      <circle cx="78" cy="86" r="16" fill="#FBBF24" stroke="#D97706" stroke-width="2.5"/>
      <path d="M72 85l3 3 6-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- 徽章飘带 -->
      <path d="M66 98l-4 8h8l-2-6" fill="#3B82F6" opacity="0.8"/>
      <path d="M90 98l4 8h-8l2-6" fill="#3B82F6" opacity="0.8"/>
    </svg>
  `;
}

function getCategoryLabel(issue: Issue): string {
  return issue.type === "script" ? t("review.category.script") : t("review.category.term");
}

function getContextMarkup(issue: Issue): string {
  const element = state.activeElement;
  if (!element) {
    return "";
  }

  const fullText = getEditableText(element);
  if (!fullText || issue.start < 0 || issue.end > fullText.length || issue.start >= issue.end) {
    return "";
  }

  const suggestion = issue.suggestions.find((s) => s.isDefault) ?? issue.suggestions[0];
  const targetValue = suggestion?.value ?? issue.sourceText;

  // 先约束窗口、再在窗口内选最近句/逗号边界（避免与 line-clamp: 2 二次裁切打架），
  // 无标点内容（代码/URL/英文）则由 line-clamp 兜底。
  const span = computeContextSpan(fullText, issue.start, issue.end);

  const before = fullText.slice(span.start, issue.start);
  const source = fullText.slice(issue.start, issue.end);
  const after = fullText.slice(issue.end, span.end);
  const hasEllipsisBefore = span.start > 0;
  const hasEllipsisAfter = span.end < fullText.length;

  return `
    <div class="cvl-review-card-context">
      ${hasEllipsisBefore ? `<span class="cvl-review-ctx-ellipsis">…</span>` : ""}
      <span class="cvl-review-ctx-before">${escapeHtml(before)}</span>
      <span class="cvl-review-ctx-source">${escapeHtml(source)}</span>
      <strong class="cvl-review-ctx-target">${escapeHtml(targetValue)}</strong>
      <span class="cvl-review-ctx-after">${escapeHtml(after)}</span>
      ${hasEllipsisAfter ? `<span class="cvl-review-ctx-ellipsis">…</span>` : ""}
    </div>
  `;
}

function getHeaderMarkup(): string {
  return `
    <div class="cvl-review-header">
      <div class="cvl-review-logo-wrap">${getLogoMarkup()}</div>
      <div class="cvl-review-header-actions">
        <button class="cvl-review-icon-btn" type="button" data-role="settings" data-tooltip="${t("review.aria.settings")}" aria-label="${t("review.aria.settings")}">
          ${getSettingsIconMarkup()}
        </button>
        <button class="cvl-review-icon-btn" type="button" data-role="close" data-tooltip="${t("review.aria.close")}" aria-label="${t("review.aria.close")}">
          ${getCloseIconMarkup()}
        </button>
      </div>
    </div>
  `;
}

function getAcceptAllMarkup(): string {
  const disabled = !state.activeElement || !canReplaceIssue(state.activeElement);
  return `<button class="cvl-review-accept-all" type="button" data-role="accept-all" ${disabled ? "disabled" : ""}>${t("review.acceptAll")}</button>`;
}

function getIssueCardMarkup(issue: Issue, index: number, total: number): string {
  const suggestion = issue.suggestions.find((s) => s.isDefault) ?? issue.suggestions[0];
  const targetValue = suggestion?.value ?? issue.sourceText;
  const replaceDisabled = !state.activeElement || !canReplaceIssue(state.activeElement);
  const canNav = total > 1;

  return `
    <div class="cvl-review-card" data-issue-id="${issue.id}" data-index="${index}">
      <div class="cvl-review-card-header">
        <span class="cvl-review-card-cat-icon cvl-review-card-cat-icon-${issue.confidence}">${getCategoryIconMarkup()}</span>
        <span class="cvl-review-card-category">${getCategoryLabel(issue)}</span>
      </div>
      ${getContextMarkup(issue)}
      <div class="cvl-review-card-actions">
        <button class="cvl-review-action-btn cvl-review-action-accept" type="button" data-action="replace" ${replaceDisabled ? "disabled" : ""}>
          ${t("review.accept")}
        </button>
        <button class="cvl-review-action-btn cvl-review-action-dismiss" type="button" data-action="ignore">${t("review.dismiss")}</button>
        <button class="cvl-review-icon-action" type="button" data-action="allow" aria-label="${t("popover.allow")}" data-tooltip="${t("popover.allow")}">${getDictionaryIconMarkup()}</button>
        <div class="cvl-review-nav-arrows">
          <button class="cvl-review-nav-arrow" type="button" data-role="prev" aria-label="${t("review.aria.prev")}" ${canNav ? "" : "disabled"}>${getChevronLeftMarkup()}</button>
          <span class="cvl-review-counter">${t("review.counter", { current: index + 1, total })}</span>
          <button class="cvl-review-nav-arrow" type="button" data-role="next" aria-label="${t("review.aria.next")}" ${canNav ? "" : "disabled"}>${getChevronRightMarkup()}</button>
        </div>
      </div>
    </div>
  `;
}

export function renderReviewInto(panel: HTMLDivElement): void {
  hideTooltip(true);
  const issues = state.activeIssues;
  const errorCount = issues.length;

  if (errorCount === 0) {
    panel.innerHTML = `
      ${getHeaderMarkup()}
      <div class="cvl-review-body">
        <div class="cvl-review-empty">
          ${getEmptyIconMarkup()}
          <div class="cvl-review-empty-title">${t("review.empty.title")}</div>
          <div class="cvl-review-empty-subtitle">${t("review.empty.subtitle")}</div>
        </div>
      </div>
    `;
    bindHeaderEvents();
    return;
  }

  if (currentIndex < 0 || currentIndex >= errorCount) {
    currentIndex = 0;
  }

  const issue = issues[currentIndex];

  panel.innerHTML = `
    ${getHeaderMarkup()}
    <div class="cvl-review-body">
      <div class="cvl-review-title-row">
        <h2 class="cvl-review-title">${t("review.title")}</h2>
        <span class="cvl-review-count">${errorCount}</span>
        ${errorCount > 1 ? getAcceptAllMarkup() : ""}
      </div>
      <div class="cvl-review-card-wrap">
        ${getIssueCardMarkup(issue, currentIndex, errorCount)}
      </div>
    </div>
  `;

  bindHeaderEvents();
  bindCardEvents();
  navigateToIssue(currentIndex);
}

function bindHeaderEvents(): void {
  const panel = ensureReviewView();
  panel.querySelectorAll<HTMLButtonElement>(".cvl-review-icon-btn").forEach((btn) => {
    attachTooltip(btn);
    btn.addEventListener("click", () => {
      const role = btn.dataset.role;
      if (role === "close") {
        hideReviewView();
      } else if (role === "settings") {
        openSettings();
      }
    });
  });
}

function bindCardEvents(): void {
  const panel = ensureReviewView();

  panel.querySelector<HTMLButtonElement>("[data-role='accept-all']")?.addEventListener("click", async () => {
    await state.actions?.replaceAll();
  });

  panel.querySelectorAll<HTMLButtonElement>(".cvl-review-icon-action").forEach((btn) => {
    attachTooltip(btn);
  });

  panel.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest<HTMLElement>(".cvl-review-card");
      const issueId = card?.dataset.issueId;
      const issue = issueId ? findIssueById(issueId) : undefined;
      if (!issue) {
        return;
      }

      const action = button.dataset.action;

      const actions = state.actions;
      if (!actions) {
        return;
      }

      if (action === "replace") {
        await actions.replace(issue);
      } else if (action === "ignore") {
        await actions.ignore(issue);
      } else if (action === "allow") {
        await actions.allow(issue);
      }
    });
  });

  panel.querySelectorAll<HTMLButtonElement>(".cvl-review-nav-arrow").forEach((button) => {
    button.addEventListener("click", () => {
      const issues = state.activeIssues;
      if (issues.length === 0) {
        return;
      }
      const role = button.dataset.role;
      if (role === "prev") {
        currentIndex = (currentIndex - 1 + issues.length) % issues.length;
      } else if (role === "next") {
        currentIndex = (currentIndex + 1) % issues.length;
      } else {
        return;
      }
      renderReviewInto(ensureReviewView());
    });
  });
}

function navigateToIssue(index: number): void {
  const issues = state.activeIssues;
  if (index < 0 || index >= issues.length) {
    return;
  }

  const issue = issues[index];
  state.popoverIssueId = issue.id;
  updateActiveMarkState();
}

export function renderReviewViewIfOpen(): void {
  if (!isReviewViewOpen()) {
    return;
  }
  if (currentIndex >= state.activeIssues.length) {
    currentIndex = 0;
  }
  renderReviewInto(ensureReviewView());
}

/**
 * 当用户在正文（可编辑上下文）中移动光标或选区时，将 reviewView 同步切换到
 * 光标所在位置对应的 issue（page）。仅在 reviewView 可见时生效。
 */
export function syncReviewToCaret(): void {
  if (!isReviewViewOpen() || !state.activeElement || state.activeIssues.length === 0) {
    return;
  }

  const offsets = getSelectionOffsets(state.activeElement);
  if (!offsets) {
    return;
  }

  // 折叠光标时以光标位置为准；有选区时取中点，便于命中覆盖区间的 issue。
  const pos =
    offsets.start === offsets.end
      ? offsets.start
      : Math.round((offsets.start + offsets.end) / 2);

  const index = state.activeIssues.findIndex(
    (issue) => pos >= issue.start && pos <= issue.end,
  );
  if (index === -1 || index === currentIndex) {
    return;
  }

  currentIndex = index;
  renderReviewInto(ensureReviewView());
}

export function resetReviewIndex(): void {
  currentIndex = 0;
  renderReviewInto(ensureReviewView());
}

/**
 * 由正文中的「原词下划线」点击触发：将 reviewView 同步切换到指定 issue 的索引页。
 * 若面板尚未打开，则直接打开并定位到该 issue；若已打开则仅切换索引页（不重新定位面板）。
 */
export function goToIssue(issueId: string): void {
  const index = state.activeIssues.findIndex((issue) => issue.id === issueId);
  if (index === -1) {
    return;
  }

  currentIndex = index;
  const panel = ensureMainPanel();
  if (panel.dataset.hidden === "true" || getMainPanelView() !== "review") {
    showMainPanel("review");
  }
  renderReviewInto(ensureReviewView());
}

export async function acceptAndAdvance(): Promise<void> {
  if (!isReviewViewOpen() || !state.actions) {
    return;
  }

  const issue = state.activeIssues[currentIndex];
  if (!issue) {
    return;
  }

  await state.actions.replace(issue);

  if (state.activeIssues.length === 0) {
    renderReviewInto(ensureReviewView());
    return;
  }

  currentIndex = Math.min(currentIndex, state.activeIssues.length - 1);
  renderReviewInto(ensureReviewView());
}
