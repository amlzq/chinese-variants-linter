import { state } from "../state";
import { ensureCvlLauncher, hideLauncher, updateLauncher } from "./cvlLauncher";
import { clearIssueMarks, renderMarks, updateActiveMarkState } from "./markLayer";
import { ensureReviewView, isReviewViewOpen, renderReviewInto, resetReviewIndex } from "./reviewView";
import { ensureSettingsView, hideSettingsView, showSettingsView } from "./settingsView";
import { MAIN_PANEL_ID, MAIN_PANEL_WIDTH } from "./styles";
import { hideSuggestionPopover } from "./suggestionPopover";

let mainPanel: HTMLDivElement | null = null;
let currentView: "review" | "settings" = "review";
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

export function ensureMainPanel(): HTMLDivElement {
    if (mainPanel) {
        return mainPanel;
    }

    mainPanel = document.createElement("div");
    mainPanel.id = MAIN_PANEL_ID;
    mainPanel.dataset.hidden = "true";
    mainPanel.dataset.view = "review";

    const review = ensureReviewView();
    const settings = ensureSettingsView();
    mainPanel.append(review, settings);
    document.documentElement.append(mainPanel);

    attachDrag();
    return mainPanel;
}

export function isMainPanelOpen(): boolean {
    return ensureMainPanel().dataset.hidden === "false";
}

export function getMainPanelView(): "review" | "settings" {
    return (ensureMainPanel().dataset.view as "review" | "settings") ?? "review";
}

function switchView(view: "review" | "settings"): void {
    const panel = ensureMainPanel();
    if (panel.dataset.view === view) {
        return;
    }
    const prevTransition = panel.style.transition;
    // Disable transition so getBoundingClientRect reflects the target size immediately.
    panel.style.transition = "none";
    // Keep the current on-screen position so the panel does not jump (e.g. on the
    // x-axis) when switching between review and settings views. The launcher is
    // right-anchored and changes width when it expands/collapses, so recomputing
    // the position from it would shift the panel horizontally.
    const prevLeft = panel.style.left;
    const prevTop = panel.style.top;
    panel.dataset.view = view;
    currentView = view;
    void panel.offsetWidth;
    if (prevLeft && prevTop) {
        panel.style.left = prevLeft;
        panel.style.top = prevTop;
        clampPanelPosition();
    } else {
        positionMainPanel();
    }
    requestAnimationFrame(() => {
        panel.style.transition = prevTransition;
    });
}

/** Clamp the panel's inline left/top into the viewport for its current size. */
function clampPanelPosition(): void {
    const panel = ensureMainPanel();
    const margin = 8;
    const rect = panel.getBoundingClientRect();
    const width = rect.width || MAIN_PANEL_WIDTH;
    const height = rect.height || 600;
    let left = parseFloat(panel.style.left);
    let top = parseFloat(panel.style.top);
    if (Number.isNaN(left)) {
        left = rect.left;
    }
    if (Number.isNaN(top)) {
        top = rect.top;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

function positionMainPanel(): void {
    const panel = ensureMainPanel();
    const launcher = ensureCvlLauncher();
    const margin = 12;
    const gap = 8;
    const rect = panel.getBoundingClientRect();
    const width = rect.width || Math.min(MAIN_PANEL_WIDTH, window.innerWidth - 2 * margin);
    const height = rect.height || Math.min(600, window.innerHeight - 2 * margin);

    let left: number;
    let top: number;

    if (launcher.dataset.hidden === "true") {
        left = margin;
        top = margin;
    } else {
        const launcherRect = launcher.getBoundingClientRect();
        left = launcherRect.left - gap - width;
        top = launcherRect.top - gap - height;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

function attachDrag(): void {
    ensureMainPanel().addEventListener("pointerdown", onHeaderPointerDown);
}

function onHeaderPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }

    const header = target.closest<HTMLElement>(".cvl-review-header, .cvl-settings-header");
    if (!header) {
        return;
    }

    // Never start a drag from a button (settings/close/dict/back).
    if (target.closest("button")) {
        return;
    }

    const panel = ensureMainPanel();
    const rect = panel.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    isDragging = true;

    header.setAttribute("data-dragging", "true");
    event.preventDefault();

    document.addEventListener("pointermove", onDocumentPointerMove);
    document.addEventListener("pointerup", onDocumentPointerUp, { once: true });
}

function onDocumentPointerMove(event: PointerEvent): void {
    if (!isDragging) {
        return;
    }

    const panel = ensureMainPanel();
    const margin = 8;
    const rect = panel.getBoundingClientRect();
    let left = event.clientX - dragOffsetX;
    let top = event.clientY - dragOffsetY;

    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

function onDocumentPointerUp(): void {
    isDragging = false;
    const panel = ensureMainPanel();
    panel
        .querySelectorAll<HTMLElement>(
            ".cvl-review-header[data-dragging], .cvl-settings-header[data-dragging]",
        )
        .forEach((el) => el.removeAttribute("data-dragging"));
    document.removeEventListener("pointermove", onDocumentPointerMove);
}

export function showMainPanel(view: "review" | "settings" = "review"): void {
    hideSuggestionPopover();
    const panel = ensureMainPanel();
    panel.dataset.hidden = "false";
    if (panel.dataset.view !== view) {
        switchView(view);
    } else {
        positionMainPanel();
    }
    // 主面板可见时隐藏 cvlLauncher（面板已承载交互），关闭时再恢复。
    hideLauncher();
}

export function openSettings(): void {
    const panel = ensureMainPanel();
    panel.dataset.hidden = "false";
    if (panel.dataset.view !== "settings") {
        switchView("settings");
    }
    // 进入设置视图时取消正文中的所有检测标记。
    hideLauncher();
    clearIssueMarks();
    void showSettingsView();
}

export function showReviewView(): void {
    switchView("review");
    hideSettingsView();
    // Keep currentIndex so we restore the same issue after returning.
    renderReviewInto(ensureReviewView());
    // 离开设置视图后重新显示正文检测标记。
    renderMarks();
}

export function openReviewView(): void {
    hideSuggestionPopover();
    resetReviewIndex();
    showMainPanel("review");
}

export function hideReviewView(): void {
    hideMainPanel();
}

export function toggleReviewView(): void {
    if (isReviewViewOpen()) {
        hideReviewView();
        return;
    }

    if (!state.activeElement || state.activeIssues.length === 0) {
        return;
    }

    openReviewView();
}

export function hideMainPanel(): void {
    const panel = ensureMainPanel();
    panel.dataset.hidden = "true";
    if (currentView === "settings") {
        hideSettingsView();
    }
    state.popoverIssueId = null;
    updateActiveMarkState();
    // 主面板关闭后恢复 cvlLauncher 可见（依据当前编辑状态）。
    updateLauncher();
}
