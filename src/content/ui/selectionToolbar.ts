import {
  convertText,
  replaceSelectionInEditable,
  type SupportedEditable,
} from "../../core/apply";
import { detectText } from "../../core/detect";
import { escapeHtml } from "../../shared/dom";
import { getVariantLabel, t } from "../../shared/locale";
import type { ExtensionSettings, Issue } from "../../shared/types";
import { getSelectionRect, type RectLike } from "../geometry/rects";
import { SELECTION_TOOLBAR_ID } from "./styles";

let selectionToolbar: HTMLDivElement | null = null;

interface SelectionToolbarState {
  text: string;
  issues: Issue[];
  anchorRect: RectLike;
  editableTarget: SupportedEditable | null;
  settings: ExtensionSettings;
  onAfterReplace?: () => void;
}

let toolbarState: SelectionToolbarState | null = null;

// 缓存上一次定位时的选区位置信息，用于避免不必要的 DOM 更新
let lastPositionedRect: { left: number; top: number; width: number; height: number } | null = null;

export function ensureSelectionToolbar(): HTMLDivElement {
  if (selectionToolbar) {
    return selectionToolbar;
  }

  selectionToolbar = document.createElement("div");
  selectionToolbar.id = SELECTION_TOOLBAR_ID;
  selectionToolbar.dataset.hidden = "true";
  selectionToolbar.dataset.expanded = "false";
  selectionToolbar.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  document.documentElement.append(selectionToolbar);
  return selectionToolbar;
}

export function isSelectionToolbarOpen(): boolean {
  return ensureSelectionToolbar().dataset.hidden === "false";
}

export function hideSelectionToolbar(): void {
  toolbarState = null;
  ensureSelectionToolbar().dataset.hidden = "true";
}

interface ShowSelectionToolbarParams {
  text: string;
  settings: ExtensionSettings;
  anchorRect: RectLike;
  editableTarget: SupportedEditable | null;
  onAfterReplace?: () => void;
}

export function showSelectionToolbar(params: ShowSelectionToolbarParams): void {
  const { text, settings, anchorRect, editableTarget, onAfterReplace } = params;

  const issues = detectText({ text, settings });
  if (issues.length === 0) {
    hideSelectionToolbar();
    return;
  }

  toolbarState = {
    text,
    issues,
    anchorRect,
    editableTarget,
    settings,
    onAfterReplace,
  };

  renderSelectionToolbar();
  positionSelectionToolbar(anchorRect, true); // 状态变化时强制更新
}

function getChevronMarkup(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
}

function renderSelectionToolbar(): void {
  const toolbar = ensureSelectionToolbar();
  if (!toolbarState) {
    hideSelectionToolbar();
    return;
  }

  const { issues, editableTarget, settings } = toolbarState;
  const count = issues.length;
  const targetLabel = getVariantLabel(settings.defaultVariant);
  const replaceDisabled = editableTarget === null;

  toolbar.dataset.hidden = "false";
  toolbar.dataset.expanded = "false";
  toolbar.innerHTML = `
    <div class="cvl-sel-header">
      <span class="cvl-sel-count">${t("selbar.count", { count })}</span>
      <button class="cvl-sel-btn cvl-sel-btn-icon" type="button" data-action="toggle" aria-label="${t("selbar.details")}">
        ${getChevronMarkup()}
      </button>
    </div>
    <div class="cvl-sel-details">
      ${issues
      .map((issue) => {
        const suggestion = issue.suggestions.find((s) => s.isDefault) ?? issue.suggestions[0];
        const target = suggestion?.value ?? issue.sourceText;
        return `
            <div class="cvl-sel-detail-item">
              <span class="cvl-sel-detail-source">${escapeHtml(issue.sourceText)}</span>
              <span class="cvl-sel-detail-arrow">→</span>
              <span class="cvl-sel-detail-target">${escapeHtml(target)}</span>
            </div>
          `;
      })
      .join("")}
    </div>
    <button class="cvl-sel-btn cvl-sel-btn-primary cvl-sel-btn-block" type="button" data-action="convert" ${replaceDisabled ? "disabled" : ""} ${replaceDisabled ? `title="${t("selbar.convertDisabled")}"` : ""}>
      ${t("selbar.convert", { variant: escapeHtml(targetLabel) })}
    </button>
    <button class="cvl-sel-btn cvl-sel-btn-secondary cvl-sel-btn-block" type="button" data-action="copy">${t("selbar.copy")}</button>
  `;

  bindToolbarEvents();
}

function bindToolbarEvents(): void {
  const toolbar = ensureSelectionToolbar();

  toolbar.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      switch (action) {
        case "convert":
          void handleConvert();
          return;
        case "copy":
          void handleCopy(button);
          return;
        case "toggle":
          toggleDetails();
          return;
        case "close":
          hideSelectionToolbar();
          return;
        default:
          return;
      }
    });
  });
}

async function handleConvert(): Promise<void> {
  if (!toolbarState || !toolbarState.editableTarget) {
    return;
  }

  const { text, settings, editableTarget, onAfterReplace } = toolbarState;
  const converted = convertText(text, settings);
  const changed = replaceSelectionInEditable(editableTarget, converted);
  if (changed) {
    hideSelectionToolbar();
    onAfterReplace?.();
  }
}

async function handleCopy(button: HTMLButtonElement): Promise<void> {
  if (!toolbarState) {
    return;
  }

  const { text, settings } = toolbarState;
  const converted = convertText(text, settings);

  let success = false;
  try {
    await navigator.clipboard.writeText(converted);
    success = true;
  } catch {
    success = fallbackCopy(converted);
  }

  if (success) {
    const original = button.textContent;
    button.textContent = t("selbar.copied");
    button.dataset.copied = "true";
    window.setTimeout(() => {
      button.textContent = original;
      button.dataset.copied = "false";
    }, 1200);
  }
}

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.append(textarea);
  textarea.select();

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  }

  textarea.remove();
  return success;
}

function toggleDetails(): void {
  const toolbar = ensureSelectionToolbar();
  const expanded = toolbar.dataset.expanded === "true";
  toolbar.dataset.expanded = expanded ? "false" : "true";
  if (toolbarState) {
    positionSelectionToolbar(toolbarState.anchorRect, true); // 展开状态变化时强制更新
  }
}

function positionSelectionToolbar(anchorRect: RectLike, forceUpdate = false): void {
  const toolbar = ensureSelectionToolbar();
  const margin = 12;
  const gap = 8;
  const toolbarRect = toolbar.getBoundingClientRect();
  const toolbarWidth = toolbarRect.width || 280;
  const toolbarHeight = toolbarRect.height || 40;

  let left = anchorRect.left;
  let top = anchorRect.bottom + gap;

  if (left + toolbarWidth > window.innerWidth - margin) {
    left = window.innerWidth - toolbarWidth - margin;
  }

  if (left < margin) {
    left = margin;
  }

  if (top + toolbarHeight > window.innerHeight - margin) {
    top = anchorRect.top - toolbarHeight - gap;
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

  // 转为文档坐标（视口坐标 + 滚动偏移），使工具条随页面/文本框滚动，
  // 而非固定在视口。配合 onScrollOrResize 中的 reposition，文本框内部滚动时仍跟随选区。
  const newLeft = `${left + window.scrollX}px`;
  const newTop = `${top + window.scrollY}px`;

  // 只有值真的变了才更新 DOM（智能检测）
  if (toolbar.style.left !== newLeft || toolbar.style.top !== newTop) {
    toolbar.style.left = newLeft;
    toolbar.style.top = newTop;
  }

  // 缓存当前位置
  lastPositionedRect = { left: anchorRect.left, top: anchorRect.top, width: anchorRect.width, height: anchorRect.height };
}

export function repositionSelectionToolbar(): void {
  if (!toolbarState) {
    return;
  }

  const rect = getSelectionRect();
  if (!rect) {
    hideSelectionToolbar();
    lastPositionedRect = null;
    return;
  }

  toolbarState.anchorRect = rect;
  positionSelectionToolbar(rect, true); // 选区可能变化，强制更新
}
