import { getEditableText } from "../../core/apply";
import { getBrandIconUrl } from "../../shared/brand";
import { openFeedbackPage } from "../../shared/feedback";
import { t } from "../../shared/locale";
import { toggleSite } from "../../shared/settingsClient";
import { containsCjk } from "../../shared/text";
import { state } from "../state";
import { isMainPanelOpen, openReviewView } from "./mainPanel";
import {
    LAUNCHER_EXPANDED_WIDTH,
    LAUNCHER_HEIGHT,
    LAUNCHER_ID,
    LAUNCHER_TOOLTIP_ID,
} from "./styles";
import { cancelHideSuggestionPopover, scheduleHideSuggestionPopover } from "./suggestionPopover";

let cvlLauncher: HTMLDivElement | null = null;
let cvlLauncherTooltip: HTMLDivElement | null = null;
let launcherBusy = false;
let launcherEditing = false;
let launcherShellReady = false;

// 缓存上一次定位时的元素位置信息，用于避免不必要的 DOM 更新
let lastPositionedRect: { left: number; top: number; width: number; height: number } | null = null;

export function ensureCvlLauncher(): HTMLDivElement {
    if (cvlLauncher) {
        return cvlLauncher;
    }

    cvlLauncher = document.createElement("div");
    cvlLauncher.id = LAUNCHER_ID;
    cvlLauncher.dataset.hidden = "true";
    cvlLauncher.dataset.expanded = "false";
    cvlLauncher.addEventListener("mouseenter", () => {
        cancelHideSuggestionPopover();
        expandLauncher();
    });
    cvlLauncher.addEventListener("mouseleave", () => {
        scheduleHideSuggestionPopover();
        collapseLauncher();
    });
    cvlLauncher.addEventListener("focusin", () => {
        cancelHideSuggestionPopover();
        expandLauncher();
    });
    cvlLauncher.addEventListener("focusout", (event) => {
        const relatedTarget = event.relatedTarget;
        if (!(relatedTarget instanceof Node) || !cvlLauncher?.contains(relatedTarget)) {
            collapseLauncher();
        }
    });
    cvlLauncher.addEventListener("mouseover", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const actionButton = target.closest<HTMLElement>(".cvl-launcher-button");
        if (!actionButton) {
            hideLauncherTooltip();
            return;
        }

        showLauncherTooltip(actionButton);
    });
    cvlLauncher.addEventListener("mouseout", (event) => {
        const relatedTarget = event.relatedTarget;
        if (!(relatedTarget instanceof Node) || !cvlLauncher?.contains(relatedTarget)) {
            hideLauncherTooltip();
            return;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const button = target.closest<HTMLElement>(".cvl-launcher-button");
        const nextButton =
            relatedTarget instanceof Element
                ? relatedTarget.closest<HTMLElement>(".cvl-launcher-button")
                : null;
        if (button && button !== nextButton) {
            hideLauncherTooltip();
        }
    });
    cvlLauncher.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const actionButton = target.closest<HTMLButtonElement>(".cvl-launcher-button");
        if (!actionButton) {
            return;
        }

        switch (actionButton.dataset.role) {
            case "status":
                hideLauncherTooltip();
                openReviewView();
                return;
            case "feedback":
                hideLauncherTooltip();
                void openFeedbackPage();
                return;
            case "disable":
                hideLauncherTooltip();
                void toggleSite(location.hostname, false);
                return;
            default:
                return;
        }
    });
    document.documentElement.append(cvlLauncher);
    return cvlLauncher;
}

function ensureCvlLauncherTooltip(): HTMLDivElement {
    if (cvlLauncherTooltip) {
        return cvlLauncherTooltip;
    }

    cvlLauncherTooltip = document.createElement("div");
    cvlLauncherTooltip.id = LAUNCHER_TOOLTIP_ID;
    cvlLauncherTooltip.dataset.hidden = "true";
    cvlLauncherTooltip.innerHTML = `
    <div class="cvl-launcher-tooltip-body"></div>
    <div class="cvl-launcher-tooltip-arrow" aria-hidden="true"></div>
  `;
    document.documentElement.append(cvlLauncherTooltip);
    return cvlLauncherTooltip;
}

function getFeedbackIconMarkup(): string {
    return `
    <svg class="cvl-launcher-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.6 12.2v-1.9c0-.7.5-1.4 1.2-1.6L15 5.6v12.8l-9.2-3.1c-.7-.2-1.2-.9-1.2-1.6v-1.5Z" />
      <path d="M9.2 15.3l1.6 4.2c.2.6.8 1 1.5 1h.8l-2.2-5.8" />
      <path d="M15 9.5c1.9.6 3.1 2 3.1 3.5S16.9 15.9 15 16.5" />
    </svg>
  `;
}

function getDisableIconMarkup(): string {
    return `
    <svg class="cvl-launcher-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v7" />
      <path d="M7.6 5.6A8 8 0 1 0 16.4 5.6" />
    </svg>
  `;
}

function getStatusButtonMarkup(): string {
    // 常态 / 错误态 / 忙碌态三层内容叠放在同一颗按钮内，由 [data-state] 控制显隐，
    // 按钮尺寸恒定，切换时无布局跳动。品牌图标通过 CSS mask 渲染为白色。
    return `
      <button
        class="cvl-launcher-button"
        type="button"
        data-role="status"
        data-tooltip="${t("launcher.status.passed")}"
        aria-label="${t("launcher.status.passed")}"
      >
        <span class="cvl-status-layer cvl-status-layer--icon" aria-hidden="true"></span>
        <span class="cvl-status-layer cvl-status-layer--count">0</span>
        <span class="cvl-status-layer cvl-status-layer--spinner" aria-hidden="true"><span class="cvl-spinner-ring"></span></span>
      </button>
    `;
}

function setLauncherExpanded(expanded: boolean): void {
    const launcher = ensureCvlLauncher();
    launcher.dataset.expanded = expanded ? "true" : "false";
    if (launcher.dataset.hidden !== "true") {
        positionLauncher();
    }
}

function expandLauncher(): void {
    // 编辑态（收缩为 20x20 圆点）下不展开，保持最小指示。
    if (launcherEditing) {
        return;
    }
    setLauncherExpanded(true);
}

export function collapseLauncher(): void {
    hideLauncherTooltip();
    setLauncherExpanded(false);
}

export function hideLauncher(): void {
    ensureCvlLauncher().dataset.hidden = "true";
    hideLauncherTooltip();
    collapseLauncher();
}

function hideLauncherTooltip(): void {
    const tooltip = ensureCvlLauncherTooltip();
    tooltip.dataset.hidden = "true";
    tooltip.dataset.visible = "false";
}

function showLauncherTooltip(target: HTMLElement): void {
    const message = target.dataset.tooltip;
    if (!message || !ensureCvlLauncher().contains(target)) {
        hideLauncherTooltip();
        return;
    }

    const tooltip = ensureCvlLauncherTooltip();
    const body = tooltip.querySelector<HTMLElement>(".cvl-launcher-tooltip-body");
    if (!body) {
        return;
    }

    body.textContent = message;
    tooltip.style.width = "";
    tooltip.dataset.hidden = "false";
    tooltip.dataset.visible = "false";

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const centerX = targetRect.left + targetRect.width / 2;
    const idealLeft = centerX - tooltipRect.width / 2;
    const left = Math.min(
        Math.max(idealLeft, margin),
        window.innerWidth - tooltipRect.width - margin,
    );
    const top = Math.max(targetRect.top - tooltipRect.height - 14, margin);
    const arrowOffset = Math.max(
        16,
        Math.min(centerX - left, tooltipRect.width - 16),
    );

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.width = `${tooltipRect.width}px`;
    tooltip.style.removeProperty("right");
    tooltip.style.setProperty("--cvl-tooltip-arrow-left", `${arrowOffset}px`);
    tooltip.dataset.visible = "true";
}

function positionLauncher(forceUpdate = false): void {
    if (!state.activeElement) {
        hideLauncher();
        lastPositionedRect = null;
        return;
    }

    const launcher = ensureCvlLauncher();
    const rect = state.activeElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        launcher.dataset.hidden = "true";
        lastPositionedRect = null;
        return;
    }

    // 如果不是强制更新，且位置没有变化，则跳过更新
    // 利用 position: absolute 的特性：元素会自动跟随文档滚动
    if (!forceUpdate && lastPositionedRect &&
        lastPositionedRect.left === rect.left &&
        lastPositionedRect.top === rect.top &&
        lastPositionedRect.width === rect.width &&
        lastPositionedRect.height === rect.height) {
        return; // 位置未变，避免不必要的 reflow
    }

    // 以文档坐标定位：锚定在文本框右下角，随页面（文本框）一起滚动，
    // 而非像 position:fixed 那样悬浮在视口。坐标 = 视口 rect + 页面滚动偏移。
    // 使用固定展开宽度定位，使右边缘始终钉在角落；药丸向左生长时不会右移。
    const margin = 8;
    const docLeft = rect.left + window.scrollX;
    const docTop = rect.top + window.scrollY;
    const width = LAUNCHER_EXPANDED_WIDTH;

    const clamp = (value: number, min: number, max: number): number =>
        max < min ? min : Math.min(Math.max(value, min), max);

    const left = clamp(
        docLeft + rect.width - margin - width,
        docLeft + margin,
        docLeft + rect.width - margin - width,
    );
    const top = clamp(
        docTop + rect.height - margin - LAUNCHER_HEIGHT,
        docTop + margin,
        docTop + rect.height - margin - LAUNCHER_HEIGHT,
    );

    // 只有值真的变了才更新 DOM（方案C：智能检测）
    const newLeft = `${left}px`;
    const newTop = `${top}px`;
    if (launcher.style.left !== newLeft || launcher.style.top !== newTop) {
        launcher.style.left = newLeft;
        launcher.style.top = newTop;
        launcher.style.right = "auto";
    }

    // 缓存当前位置
    lastPositionedRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function updateLauncher(): void {
    // 主面板（review / settings）可见时，cvlLauncher 应保持隐藏，由面板承载交互。
    if (isMainPanelOpen()) {
        hideLauncher();
        return;
    }

    if (!state.activeElement) {
        hideLauncher();
        return;
    }

    const text = getEditableText(state.activeElement);
    if (!text.trim()) {
        hideLauncher();
        return;
    }
    if (!containsCjk(text)) {
        hideLauncher();
        return;
    }

    const launcher = ensureCvlLauncher();
    const errorCount = state.activeIssues.length;
    launcher.dataset.hidden = "false";
    launcher.dataset.state = launcherEditing
        ? "editing"
        : launcherBusy
            ? "busy"
            : errorCount > 0
                ? "error"
                : "success";

    // shell 结构固定，仅在首次展示时构建一次；后续仅切换状态，避免布局跳动。
    if (!launcherShellReady) {
        launcher.style.setProperty("--cvl-status-icon", `url("${getBrandIconUrl()}")`);
        launcher.innerHTML = `
          <div class="cvl-launcher-shell">
            <button
              class="cvl-launcher-button"
              type="button"
              data-role="disable"
              data-tooltip="${t("launcher.disable.tooltip")}"
              aria-label="${t("launcher.disable.tooltip")}"
            >
              ${getDisableIconMarkup()}
            </button>
            <button
              class="cvl-launcher-button"
              type="button"
              data-role="feedback"
              data-tooltip="${t("launcher.feedback.tooltip")}"
              aria-label="${t("launcher.feedback.tooltip")}"
            >
              ${getFeedbackIconMarkup()}
            </button>
            ${getStatusButtonMarkup()}
          </div>
        `;
        launcherShellReady = true;
    }

    const statusButton = launcher.querySelector<HTMLButtonElement>(
        '.cvl-launcher-button[data-role="status"]',
    );
    if (statusButton) {
        const tooltip = launcherBusy
            ? t("launcher.status.checking")
            : errorCount > 0
                ? t("launcher.status.issues", { count: errorCount })
                : t("launcher.status.passed");
        statusButton.dataset.tooltip = tooltip;
        statusButton.setAttribute(
            "aria-label",
            errorCount > 0
                ? t("launcher.status.issues", { count: errorCount })
                : t("launcher.status.passed"),
        );
        const countEl = statusButton.querySelector<HTMLElement>(".cvl-status-layer--count");
        if (countEl) {
            countEl.textContent = errorCount > 99 ? "99+" : String(errorCount);
        }
    }

    positionLauncher(true); // 状态变化时强制更新位置
}

/**
 * 标记启动器进入「忙碌」态（正在检测当前文本是否存在建议项）。
 * 检测期间状态按钮显示主题色背景上的白色环形 loading。
 */
export function setLauncherBusy(busy: boolean): void {
    launcherBusy = busy;
    updateLauncher();
}

/**
 * 标记启动器进入「编辑」态：文本框正在输入，收缩为 20x20 主题色实心圆点。
 * 输入停止后由检测流程切回忙碌态并最终呈现检测结果。
 */
export function setLauncherEditing(editing: boolean): void {
    launcherEditing = editing;
    updateLauncher();
}
