import settingsCss from "./settings.css?inline";

export const STYLE_ID = "cvl-style";
export const LAYER_ID = "cvl-mark-layer";
export const POPOVER_ID = "cvl-suggestion-popover";
export const LAUNCHER_ID = "cvl-launcher";
export const LAUNCHER_TOOLTIP_ID = "cvl-launcher-tooltip";
export const TOOLTIP_ID = "cvl-tooltip";
export const TOOLTIP_BODY_CLASS = "cvl-tooltip-body";
export const TOOLTIP_ARROW_CLASS = "cvl-tooltip-arrow";
export const MAIN_PANEL_ID = "cvl-main-panel";
export const REVIEW_VIEW_ID = "cvl-review-view";
export const SELECTION_TOOLBAR_ID = "cvl-selection-toolbar";
export const SETTINGS_VIEW_ID = "cvl-settings-view";

export const ACTIVE_CLASS = "cvl-active-editable";

export const HIDE_DELAY_MS = 120;

export const LAUNCHER_HEIGHT = 34;
export const LAUNCHER_BUTTON_SIZE = 28;
export const LAUNCHER_COLLAPSED_SUCCESS_WIDTH = 38;
export const LAUNCHER_COLLAPSED_ERROR_WIDTH = 38;
export const LAUNCHER_EXPANDED_WIDTH = 108;
export const LAUNCHER_MARGIN = 12;

// review 与 settings 共用一个中间宽度，切换视图时宽度保持不变。
export const MAIN_PANEL_WIDTH = 460;

export function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* ── 主题变量（品牌色 #176B8A 深浅主题通用；表面/文本色由 prefers-color-scheme 覆盖）──
       所有页内浮层共用一套语义化变量，跟随浏览器 / 系统深浅色偏好。 */
    #${MAIN_PANEL_ID},
    #${POPOVER_ID},
    #${SELECTION_TOOLBAR_ID},
    #${LAUNCHER_ID} {
      color-scheme: light dark;
      --cvl-primary: #176B8A;
      --cvl-primary-dark: #115A75;
      --cvl-primary-soft: #e8f2f7;
      --cvl-primary-soft-hover: #d6e9f2;
      --cvl-on-primary: #ffffff;
      --cvl-focus-ring: rgba(23, 107, 138, 0.55);
      --cvl-focus-ring-strong: rgba(23, 107, 138, 0.9);
      --cvl-focus-ring-soft: rgba(23, 107, 138, 0.2);
      --cvl-recording-ring: rgba(23, 107, 138, 0.35);
      --cvl-recording-ring-faint: rgba(23, 107, 138, 0.15);
      --cvl-bg: #ffffff;
      --cvl-bg-soft: #f8fafc;
      --cvl-bg-hover: #f1f5f9;
      --cvl-text-strong: #1e293b;
      --cvl-text-body: #334155;
      --cvl-text-muted: #475569;
      --cvl-text-subtle: #64748b;
      --cvl-text-faint: #94a3b8;
      --cvl-border: #f1f5f9;
      --cvl-border-input: #cbd5e1;
      --cvl-border-frame: rgba(148, 163, 184, 0.3);
      --cvl-shadow-lg: 0 18px 40px rgba(15, 23, 42, 0.22);
      --cvl-shadow-md: 0 8px 18px rgba(15, 23, 42, 0.12);
      --cvl-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.1);
      --cvl-badge-bg: #1e293b;
      --cvl-warn-text: #b45309;
      --cvl-success: #16a34a;
      --cvl-danger: #f01412;
      --cvl-launcher-bg: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      --cvl-launcher-border: #b7bfd2;
      --cvl-launcher-icon: #7a7f87;
      --cvl-launcher-icon-hover: #60656f;
    }

    @media (prefers-color-scheme: dark) {
      #${MAIN_PANEL_ID},
      #${POPOVER_ID},
      #${SELECTION_TOOLBAR_ID},
      #${LAUNCHER_ID} {
        --cvl-bg: #1e293b;
        --cvl-bg-soft: #243049;
        --cvl-bg-hover: #334155;
        --cvl-text-strong: #f1f5f9;
        --cvl-text-body: #cbd5e1;
        --cvl-text-muted: #94a3b8;
        --cvl-text-subtle: #94a3b8;
        --cvl-text-faint: #64748b;
        --cvl-border: rgba(148, 163, 184, 0.16);
        --cvl-border-input: #475569;
        --cvl-border-frame: rgba(148, 163, 184, 0.22);
        /* 深色模式下主操作按钮的柔和背景改为品牌色低透明叠加，
           避免浅色 #e8f2f7 在深色面板上过于刺眼。 */
        --cvl-primary-soft: rgba(23, 107, 138, 0.32);
        --cvl-primary-soft-hover: rgba(23, 107, 138, 0.48);
        --cvl-shadow-lg: 0 18px 40px rgba(0, 0, 0, 0.5);
        --cvl-shadow-md: 0 8px 18px rgba(0, 0, 0, 0.4);
        --cvl-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.45);
        --cvl-badge-bg: #475569;
        --cvl-warn-text: #fbbf24;
        --cvl-success: #4ade80;
        --cvl-launcher-bg: linear-gradient(180deg, #2a3756 0%, #1e293b 100%);
        --cvl-launcher-border: #475569;
        --cvl-launcher-icon: #94a3b8;
        --cvl-launcher-icon-hover: #cbd5e1;
      }
    }

    .${ACTIVE_CLASS} {
      outline: none !important;
    }

    #${LAYER_ID} {
      position: absolute;
      inset: 0;
      z-index: 2147483646;
      pointer-events: none;
    }

    #${LAYER_ID}[data-hidden="true"] {
      display: none;
    }

    #${LAYER_ID} .cvl-mark {
      position: absolute;
      display: block;
      border: 0;
      padding: 0;
      background: transparent;
      pointer-events: auto;
      cursor: pointer;
    }

    #${LAYER_ID} .cvl-mark-highlight {
      position: absolute;
      border-radius: 3px;
      pointer-events: none;
      background: rgba(251, 113, 133, 0.22);
      z-index: 0;
    }

    #${LAYER_ID} .cvl-mark-highlight[data-confidence="medium"] {
      background: rgba(245, 158, 11, 0.24);
    }

    #${LAYER_ID} .cvl-mark::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      border-radius: 999px;
      background: #fb7185;
    }

    #${LAYER_ID} .cvl-mark[data-confidence="medium"]::after {
      background: #f59e0b;
    }

    #${LAYER_ID} .cvl-mark[data-active="true"]::after {
      height: 4px;
      background: #e11d48;
    }

    #${LAYER_ID} .cvl-mark[data-confidence="medium"][data-active="true"]::after {
      background: #d97706;
    }

    #${POPOVER_ID} {
      position: absolute;
      z-index: 2147483647;
      width: 320px;
      max-width: min(320px, calc(100vw - 24px));
      border-radius: 14px;
      border: 1px solid var(--cvl-border-frame);
      background: var(--cvl-bg);
      box-shadow: var(--cvl-shadow-lg);
      padding: 12px;
      color: var(--cvl-text-body);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }

    #${POPOVER_ID}[data-hidden="true"] {
      display: none;
    }

    #${POPOVER_ID} .cvl-popover-message {
      color: var(--cvl-text-muted);
      font-size: 12px;
      margin-bottom: 8px;
    }

    #${POPOVER_ID} .cvl-popover-warning {
      color: var(--cvl-warn-text);
      font-size: 11px;
      margin-bottom: 8px;
    }

    #${POPOVER_ID} .cvl-popover-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    #${POPOVER_ID} .cvl-popover-button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: 0;
      border-radius: 9px;
      padding: 6px 10px;
      background: transparent;
      color: var(--cvl-text-muted);
      text-align: left;
      cursor: pointer;
      font: inherit;
    }

    #${POPOVER_ID} .cvl-popover-button:hover {
      background: var(--cvl-bg-soft);
    }

    #${POPOVER_ID} .cvl-popover-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #${POPOVER_ID} .cvl-popover-button strong {
      color: var(--cvl-primary);
      font-weight: 700;
    }

    #${POPOVER_ID} .cvl-popover-button-primary {
      background: var(--cvl-primary-soft);
    }

    /* 主操作按钮 hover 走品牌色加深一档，而非通用的 --cvl-bg-soft，
       避免 dark 模式下浅蓝背景突变为深色。 */
    #${POPOVER_ID} .cvl-popover-button-primary:hover:not(:disabled) {
      background: var(--cvl-primary-soft-hover);
    }

    #${LAUNCHER_ID} {
      position: absolute;
      z-index: 2147483647;
      height: ${LAUNCHER_HEIGHT}px;
      overflow: visible;
      /* 固定容器宽度并右对齐内容：展开时药丸从右向左生长，
         状态按钮（锚点）始终钉在文本框右下角，不会随宽度动画右移。 */
      width: ${LAUNCHER_EXPANDED_WIDTH}px;
      display: flex;
      justify-content: flex-end;
      /* 收缩时容器左侧存在不可见区域，禁用其指针事件以免拦截文本框点击；
         仅可见药丸（.cvl-launcher-shell）恢复交互。 */
      pointer-events: none;
    }

    #${LAUNCHER_ID}[data-hidden="true"] {
      display: none;
    }

    #${LAUNCHER_ID} .cvl-launcher-shell {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0;
      width: ${LAUNCHER_COLLAPSED_SUCCESS_WIDTH}px;
      height: ${LAUNCHER_HEIGHT}px;
      padding: 1px 4px;
      box-sizing: border-box;
      border: 1px solid var(--cvl-launcher-border);
      border-radius: 999px;
      background: var(--cvl-launcher-bg);
      box-shadow:
        var(--cvl-shadow-sm),
        var(--cvl-shadow-md);
      overflow: hidden;
      /* 仅可见药丸接收指针事件（容器已禁用，避免遮挡文本框） */
      pointer-events: auto;
      transition:
        width 160ms ease,
        height 160ms ease,
        border-radius 160ms ease,
        box-shadow 160ms ease,
        transform 160ms ease;
    }

    #${LAUNCHER_ID}[data-state="error"] .cvl-launcher-shell {
      width: ${LAUNCHER_COLLAPSED_ERROR_WIDTH}px;
    }

    /* 编辑态：收缩为 10x10 主题色实心圆点 */
    #${LAUNCHER_ID}[data-state="editing"] .cvl-launcher-shell {
      width: 10px;
      height: 10px;
      padding: 0;
      border-radius: 999px;
      border-color: transparent;
      background: var(--cvl-primary);
      box-shadow: var(--cvl-shadow-sm);
      animation: cvl-launcher-pulse 1.4s ease-out infinite;
    }

    #${LAUNCHER_ID}[data-state="editing"] .cvl-launcher-button {
      opacity: 0;
      width: 0;
      margin: 0;
      pointer-events: none;
    }

    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-shell {
      gap: 3px;
      width: ${LAUNCHER_EXPANDED_WIDTH}px;
    }

    /* 收缩时呈哨子形状：仅左上角收尖，其余三角保持大圆角 */
    #${LAUNCHER_ID}:not([data-expanded="true"]) .cvl-launcher-shell {
      border-top-left-radius: 4px;
    }

    #${LAUNCHER_ID}:hover .cvl-launcher-shell {
      transform: translateY(-1px);
      box-shadow:
        var(--cvl-shadow-sm),
        var(--cvl-shadow-md);
    }

    #${LAUNCHER_ID}:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${LAUNCHER_ID} .cvl-launcher-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${LAUNCHER_BUTTON_SIZE}px;
      height: ${LAUNCHER_BUTTON_SIZE}px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--cvl-launcher-icon);
      cursor: pointer;
      padding: 0;
      flex: 0 0 auto;
      transition:
        background-color 140ms ease,
        color 140ms ease,
        opacity 140ms ease,
        transform 140ms ease;
    }

    #${LAUNCHER_ID} .cvl-launcher-button:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${LAUNCHER_ID} .cvl-launcher-button[data-role="status"] {
      width: ${LAUNCHER_BUTTON_SIZE}px;
      height: ${LAUNCHER_BUTTON_SIZE}px;
      padding: 0;
      color: #fff;
      background: var(--cvl-primary);
      overflow: hidden;
      transition:
        background-color 160ms ease,
        color 160ms ease;
    }

    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-button[data-role="disable"]:hover,
    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-button[data-role="disable"]:focus-visible,
    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-button[data-role="feedback"]:hover,
    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-button[data-role="feedback"]:focus-visible {
      background: rgba(148, 163, 184, 0.18);
      color: var(--cvl-launcher-icon-hover);
    }

    /* 三种状态共用同一颗按钮：内层内容叠放并按 data-state 显隐，按钮尺寸恒定不跳动 */
    #${LAUNCHER_ID} .cvl-status-layer {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 160ms ease;
      pointer-events: none;
    }

    #${LAUNCHER_ID} .cvl-status-layer--icon {
      background-color: #fff;
      -webkit-mask: var(--cvl-status-icon) center / 16px 16px no-repeat;
      mask: var(--cvl-status-icon) center / 16px 16px no-repeat;
    }

    #${LAUNCHER_ID} .cvl-status-layer--count {
      color: #fff;
      font: 700 13px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }

    #${LAUNCHER_ID} .cvl-spinner-ring {
      width: 16px;
      height: 16px;
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 999px;
      animation: cvl-launcher-spin 0.7s linear infinite;
    }

    @keyframes cvl-launcher-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes cvl-launcher-pulse {
      0% {
        box-shadow: 0 0 0 0 var(--cvl-recording-ring);
      }
      70% {
        box-shadow: 0 0 0 4px rgba(23, 107, 138, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(23, 107, 138, 0);
      }
    }

    #${LAUNCHER_ID}[data-state="error"] .cvl-launcher-button[data-role="status"] {
      background: var(--cvl-danger);
    }

    #${LAUNCHER_ID}[data-state="success"] .cvl-status-layer--icon,
    #${LAUNCHER_ID}[data-state="error"] .cvl-status-layer--count,
    #${LAUNCHER_ID}[data-state="busy"] .cvl-status-layer--spinner {
      opacity: 1;
    }

    #${LAUNCHER_ID} .cvl-launcher-button[data-role="feedback"],
    #${LAUNCHER_ID} .cvl-launcher-button[data-role="disable"] {
      opacity: 0;
      transform: translateX(10px);
      pointer-events: none;
      transition:
        opacity 140ms ease,
        transform 140ms ease;
    }

    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-button[data-role="feedback"],
    #${LAUNCHER_ID}[data-expanded="true"] .cvl-launcher-button[data-role="disable"] {
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }

    #${LAUNCHER_ID}:not([data-expanded="true"]) .cvl-launcher-button[data-role="disable"],
    #${LAUNCHER_ID}:not([data-expanded="true"]) .cvl-launcher-button[data-role="feedback"] {
      width: 0;
      margin: 0;
    }

    #${LAUNCHER_TOOLTIP_ID} {
      position: fixed;
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    #${LAUNCHER_TOOLTIP_ID}[data-hidden="true"] {
      display: none;
    }

    #${LAUNCHER_TOOLTIP_ID}[data-visible="true"] {
      opacity: 1;
    }

    #${LAUNCHER_TOOLTIP_ID} .cvl-launcher-tooltip-body {
      width: max-content;
      max-width: 280px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #34395a;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
      color: #ffffff;
      font: 400 12px/1.35 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      letter-spacing: 0;
      text-align: center;
      white-space: normal;
    }

    #${LAUNCHER_TOOLTIP_ID} .cvl-launcher-tooltip-arrow {
      position: absolute;
      left: var(--cvl-tooltip-arrow-left, 50%);
      bottom: -6px;
      width: 14px;
      height: 14px;
      transform: translateX(-50%) rotate(45deg);
      background: #34395a;
    }

    #${TOOLTIP_ID} {
      position: fixed;
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    #${TOOLTIP_ID}[data-hidden="true"] {
      display: none;
    }

    #${TOOLTIP_ID}[data-visible="true"] {
      opacity: 1;
    }

    #${TOOLTIP_ID} .${TOOLTIP_BODY_CLASS} {
      width: max-content;
      max-width: 280px;
      padding: 8px 12px;
      border-radius: 10px;
      background: #34395a;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
      color: #ffffff;
      font: 400 12px/1.35 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      text-align: center;
      white-space: nowrap;
    }

    #${TOOLTIP_ID} .${TOOLTIP_ARROW_CLASS} {
      position: absolute;
      width: 14px;
      height: 14px;
      transform: translateX(-50%) rotate(45deg);
      background: #34395a;
    }

    #${TOOLTIP_ID}[data-placement="bottom"] .${TOOLTIP_ARROW_CLASS} {
      left: var(--cvl-tooltip-arrow-left, 50%);
      top: -6px;
    }

    #${TOOLTIP_ID}[data-placement="top"] .${TOOLTIP_ARROW_CLASS} {
      left: var(--cvl-tooltip-arrow-left, 50%);
      bottom: -6px;
    }

    #${LAUNCHER_ID} .cvl-launcher-svg {
      width: 16px;
      height: 16px;
      display: block;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }

    #${LAUNCHER_ID} .cvl-launcher-count {
      display: none;
    }

    #${MAIN_PANEL_ID} {
      position: fixed;
      z-index: 2147483646;
      width: ${MAIN_PANEL_WIDTH}px;
      max-width: calc(100vw - 24px);
      height: min(256px, calc(100vh - 24px));
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid var(--cvl-border-frame);
      background: var(--cvl-bg);
      box-shadow: var(--cvl-shadow-lg);
      overflow: hidden;
      color: var(--cvl-text-body);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      transition: width 160ms ease, height 160ms ease;
    }

    #${MAIN_PANEL_ID}[data-hidden="true"] {
      display: none;
    }

    #${MAIN_PANEL_ID}[data-view="settings"] {
      width: ${MAIN_PANEL_WIDTH}px;
      max-width: calc(100vw - 24px);
      height: min(calc(100vh - 64px), 600px);
    }

    #${MAIN_PANEL_ID}[data-view="review"] #${SETTINGS_VIEW_ID} {
      display: none;
    }

    #${MAIN_PANEL_ID}[data-view="settings"] #${REVIEW_VIEW_ID} {
      display: none;
    }

    #${MAIN_PANEL_ID} .cvl-settings-header {
      cursor: grab;
      user-select: none;
      touch-action: none;
      transition: background-color 140ms ease;
    }

    #${MAIN_PANEL_ID} .cvl-settings-header:hover {
      background: var(--cvl-bg-hover);
    }

    #${MAIN_PANEL_ID} .cvl-settings-header[data-dragging="true"] {
      cursor: grabbing;
    }

    #${REVIEW_VIEW_ID} {
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    #${REVIEW_VIEW_ID} .cvl-review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--cvl-border);
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
      touch-action: none;
      transition: background-color 140ms ease;
    }

    #${REVIEW_VIEW_ID} .cvl-review-header:hover {
      background: var(--cvl-bg-hover);
    }

    #${REVIEW_VIEW_ID} .cvl-review-header[data-dragging="true"] {
      cursor: grabbing;
    }

    #${REVIEW_VIEW_ID} .cvl-review-logo-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-logo {
      width: 24px;
      height: 24px;
      display: block;
    }

    #${REVIEW_VIEW_ID} .cvl-review-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--cvl-text-subtle);
      cursor: pointer;
      padding: 0;
      transition: background-color 140ms ease, color 140ms ease;
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-btn:hover {
      background: var(--cvl-bg-hover);
      color: var(--cvl-text-body);
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-btn:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon {
      width: 18px;
      height: 18px;
      display: block;
    }

    #${REVIEW_VIEW_ID} .cvl-review-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    #${REVIEW_VIEW_ID} .cvl-review-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--cvl-text-strong);
      margin: 0;
    }

    #${REVIEW_VIEW_ID} .cvl-review-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--cvl-badge-bg);
      color: var(--cvl-on-primary);
      font-size: 12px;
      font-weight: 700;
    }

    #${REVIEW_VIEW_ID} .cvl-review-accept-all {
      margin-left: auto;
      border: 0;
      border-radius: 8px;
      padding: 5px 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      background: var(--cvl-primary-soft);
      color: var(--cvl-primary);
      transition: background-color 140ms ease;
    }

    #${REVIEW_VIEW_ID} .cvl-review-accept-all:hover:not(:disabled) {
      background: var(--cvl-primary-soft-hover);
    }

    #${REVIEW_VIEW_ID} .cvl-review-accept-all:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${REVIEW_VIEW_ID} .cvl-review-accept-all:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-wrap {
      display: flex;
      flex-direction: column;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card {
      border-radius: 12px;
      background: var(--cvl-bg);
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 0 10px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-cat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-cat-icon svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-cat-icon-high {
      color: #e11d48;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-cat-icon-medium {
      color: #d97706;
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-category {
      font-size: 12px;
      font-weight: 600;
      color: var(--cvl-text-muted);
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-context {
      padding: 10px 14px;
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.6;
      color: var(--cvl-text-subtle);
      word-break: break-word;
      background: var(--cvl-bg-soft);
      border-radius: 8px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }

    #${REVIEW_VIEW_ID} .cvl-review-ctx-before,
    #${REVIEW_VIEW_ID} .cvl-review-ctx-after {
      color: var(--cvl-text-faint);
    }

    #${REVIEW_VIEW_ID} .cvl-review-ctx-source {
      color: var(--cvl-text-faint);
      font-weight: 700;
      text-decoration: line-through;
      text-decoration-color: var(--cvl-text-subtle);
      text-decoration-thickness: 2px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-ctx-target {
      color: var(--cvl-text-strong);
      font-weight: 700;
    }

    #${REVIEW_VIEW_ID} .cvl-review-ctx-ellipsis {
      color: var(--cvl-border-input);
    }

    #${REVIEW_VIEW_ID} .cvl-review-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 0 0 14px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-btn {
      border: 0;
      border-radius: 8px;
      padding: 7px 14px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 140ms ease, color 140ms ease;
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-accept:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.9);
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-dismiss:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-accept {
      background: var(--cvl-primary);
      color: var(--cvl-on-primary);
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-accept:hover:not(:disabled) {
      background: var(--cvl-primary-dark);
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-accept:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-dismiss {
      background: transparent;
      color: var(--cvl-text-subtle);
    }

    #${REVIEW_VIEW_ID} .cvl-review-action-dismiss:hover {
      background: var(--cvl-bg-hover);
      color: var(--cvl-text-body);
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--cvl-text-subtle);
      cursor: pointer;
      padding: 0;
      transition: background-color 140ms ease, color 140ms ease;
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-action:hover {
      background: var(--cvl-bg-hover);
      color: var(--cvl-text-body);
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-action:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${REVIEW_VIEW_ID} .cvl-review-icon-action svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    #${REVIEW_VIEW_ID} .cvl-review-nav-arrows {
      display: inline-flex;
      align-items: center;
      gap: 1px;
      margin-left: auto;
    }

    #${REVIEW_VIEW_ID} .cvl-review-nav-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 28px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--cvl-text-subtle);
      cursor: pointer;
      padding: 0;
      transition: background-color 140ms ease, color 140ms ease;
    }

    #${REVIEW_VIEW_ID} .cvl-review-nav-arrow:hover:not(:disabled) {
      background: var(--cvl-bg-hover);
      color: var(--cvl-text-body);
    }

    #${REVIEW_VIEW_ID} .cvl-review-nav-arrow:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${REVIEW_VIEW_ID} .cvl-review-nav-arrow:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    #${REVIEW_VIEW_ID} .cvl-review-nav-arrow svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    #${REVIEW_VIEW_ID} .cvl-review-counter {
      font-size: 12px;
      font-weight: 600;
      color: var(--cvl-text-subtle);
      min-width: 36px;
      text-align: center;
    }

    #${REVIEW_VIEW_ID} .cvl-review-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      text-align: center;
    }

    #${REVIEW_VIEW_ID} .cvl-review-empty-icon {
      width: 90px;
      height: 90px;
      margin-bottom: 0;
    }

    #${REVIEW_VIEW_ID} .cvl-review-empty-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--cvl-text-strong);
      margin-bottom: 8px;
    }

    #${REVIEW_VIEW_ID} .cvl-review-empty-subtitle {
      font-size: 14px;
      color: var(--cvl-text-faint);
      line-height: 1.5;
    }

    #${SELECTION_TOOLBAR_ID} {
      position: absolute;
      z-index: 2147483647;
      max-width: min(360px, calc(100vw - 24px));
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--cvl-border-frame);
      background: var(--cvl-bg);
      box-shadow: var(--cvl-shadow-lg);
      overflow: hidden;
      color: var(--cvl-text-body);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    }

    #${SELECTION_TOOLBAR_ID}[data-hidden="true"] {
      display: none;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 0 6px;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-count {
      font-size: 12px;
      font-weight: 600;
      color: var(--cvl-text-subtle);
      white-space: nowrap;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-block {
      display: block;
      width: 100%;
      text-align: left;
      margin: 0;
      border-radius: 8px;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-block + .cvl-sel-btn-block {
      margin-top: 4px;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn {
      border: 0;
      border-radius: 8px;
      padding: 8px 12px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 140ms ease, color 140ms ease;
      white-space: nowrap;
      box-sizing: border-box;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--cvl-focus-ring);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-primary {
      background: var(--cvl-primary-soft);
      color: var(--cvl-primary);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-primary:hover:not(:disabled) {
      background: var(--cvl-primary-soft-hover);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-secondary {
      background: transparent;
      color: var(--cvl-text-muted);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-secondary:hover {
      background: var(--cvl-bg-hover);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-secondary[data-copied="true"] {
      color: var(--cvl-success);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      color: var(--cvl-text-subtle);
      border-radius: 6px;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-icon:hover {
      background: var(--cvl-bg-hover);
      color: var(--cvl-text-body);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-icon svg {
      width: 16px;
      height: 16px;
      display: block;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-icon[data-action="toggle"] {
      transition: transform 160ms ease;
    }

    #${SELECTION_TOOLBAR_ID}[data-expanded="true"] .cvl-sel-btn-icon[data-action="toggle"] {
      transform: rotate(180deg);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-details {
      display: none;
      padding: 4px 0 4px 12px;
      max-height: 200px;
      overflow-y: auto;
    }

    #${SELECTION_TOOLBAR_ID}[data-expanded="true"] .cvl-sel-details {
      display: block;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-detail-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      font-size: 13px;
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-detail-source {
      color: var(--cvl-text-faint);
      text-decoration: line-through;
      text-decoration-color: var(--cvl-text-faint);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-detail-arrow {
      color: var(--cvl-border-input);
    }

    #${SELECTION_TOOLBAR_ID} .cvl-sel-detail-target {
      color: var(--cvl-text-strong);
      font-weight: 600;
    }

    /* 深色模式下主操作按钮文字提亮，保证在 --cvl-primary-soft 叠加背景上的可读性 */
    @media (prefers-color-scheme: dark) {
      #${POPOVER_ID} .cvl-popover-button strong,
      #${SELECTION_TOOLBAR_ID} .cvl-sel-btn-primary {
        color: #7dd3fc;
      }
    }

  ` + settingsCss;
  document.documentElement.append(style);
}
