import { getSelectionRect, type RectLike } from "../src/content/geometry/rects";
import { matchCombo } from "../src/content/shortcuts";
import { ensureIgnoredSet, state } from "../src/content/state";
import { collapseLauncher, ensureCvlLauncher, hideLauncher, setLauncherBusy, setLauncherEditing, updateLauncher } from "../src/content/ui/cvlLauncher";
import { ensureMainPanel, toggleReviewView } from "../src/content/ui/mainPanel";
import { clearIssueMarks, ensureMarkLayer, renderMarks } from "../src/content/ui/markLayer";
import { acceptAndAdvance, ensureReviewView, isReviewViewOpen, renderReviewViewIfOpen, syncReviewToCaret } from "../src/content/ui/reviewView";
import { ensureSelectionToolbar, hideSelectionToolbar, isSelectionToolbarOpen, repositionSelectionToolbar, showSelectionToolbar } from "../src/content/ui/selectionToolbar";
import { ensureSettingsView, isSettingsViewOpen } from "../src/content/ui/settingsView";
import { ACTIVE_CLASS, ensureStyles } from "../src/content/ui/styles";
import { ensureSuggestionPopover, hideSuggestionPopover, repositionSuggestionPopover, scheduleHideSuggestionPopover } from "../src/content/ui/suggestionPopover";
import {
  applyIssueSuggestion,
  convertText,
  getEditableText,
  isEditableElement,
  replaceSelectionInEditable,
  type SupportedEditable,
} from "../src/core/apply";
import { detectText } from "../src/core/detect";
import { getSettings, isSiteEnabled, STORAGE_KEY } from "../src/core/storage";
import { containsCjk } from "../src/shared/text";
import { detectDefaultRegion, setRegion } from "../src/shared/locale";
import type { ExtensionSettings, Issue, ShortcutAction } from "../src/shared/types";

let settings: ExtensionSettings;
let detectionTimer: number | null = null;
// 页内 UI（样式、标记层、浮层、启动器、面板）只在当前站点开启检查后才创建，
// 未开启的站点不向页面插入任何节点，页面级事件处理也直接返回。
let uiReady = false;

// RAF 节流相关变量（方案B：将多次滚动事件合并为一次更新）
let scrollRafId: number | null = null;
let pendingScrollUpdate = false;

function setActiveElement(element: SupportedEditable | null): void {
  if (state.activeElement && state.activeElement !== element) {
    state.activeElement.classList.remove(ACTIVE_CLASS);
  }

  state.activeElement = element;
  if (state.activeElement) {
    state.activeElement.classList.add(ACTIVE_CLASS);
  }
}

function isCheckingActive(): boolean {
  return settings.enabled && isSiteEnabled(settings, location.hostname);
}

function ensureUi(): void {
  if (uiReady) {
    return;
  }

  uiReady = true;
  ensureStyles();
  ensureMarkLayer();
  ensureSuggestionPopover();
  ensureCvlLauncher();
  ensureMainPanel();
  ensureSelectionToolbar();
}

function isExtensionUiTarget(target: EventTarget | null): boolean {
  return (
    uiReady &&
    target instanceof Node &&
    (ensureSuggestionPopover().contains(target) ||
      ensureMarkLayer().contains(target) ||
      ensureCvlLauncher().contains(target) ||
      ensureReviewView().contains(target) ||
      ensureSelectionToolbar().contains(target) ||
      ensureSettingsView().contains(target))
  );
}

function clearDecorations(): void {
  setLauncherEditing(false);
  setLauncherBusy(false);
  clearIssueMarks();
  hideLauncher();
  renderReviewViewIfOpen();
}

async function detectActiveElement(force = false): Promise<void> {
  // 输入已停止：离开编辑态（20x20 圆点），准备切入忙碌态检测。
  setLauncherEditing(false);

  if (!state.activeElement) {
    state.activeIssues = [];
    clearDecorations();
    return;
  }

  if (!settings.enabled || !isSiteEnabled(settings, location.hostname)) {
    state.activeIssues = [];
    clearDecorations();
    return;
  }

  const fullText = getEditableText(state.activeElement);
  if (!fullText.trim()) {
    state.activeIssues = [];
    clearDecorations();
    return;
  }

  // 切入忙碌态：正在检测当前文本是否存在建议项。
  setLauncherBusy(true);

  // 防止超大可编辑元素（如巨型 contenteditable / textarea）在每次输入后触发整段检测，
  // 造成主线程长时间阻塞。超出上限时仅对前 MAX_FULLTEXT_LENGTH 个字符做检测。
  const text = fullText.length > MAX_FULLTEXT_LENGTH
    ? fullText.slice(0, MAX_FULLTEXT_LENGTH)
    : fullText;

  const ignored = Array.from(ensureIgnoredSet(state.activeElement));
  state.activeIssues = detectText({
    text,
    settings,
    ignoredIssueIds: ignored,
  });
  setLauncherBusy(false);

  if (!force && state.activeIssues.length === 0) {
    clearIssueMarks();
    updateLauncher();
    renderReviewViewIfOpen();
    return;
  }

  renderMarks();
  renderReviewViewIfOpen();
}

function scheduleDetection(immediate = false): void {
  if (detectionTimer) {
    window.clearTimeout(detectionTimer);
  }

  // 站点/全局检查已关闭（UI 已创建但不再工作）：不进入编辑态，否则启动器圆点会
  // 在聚焦时闪现、待检测定时器触发后才被隐藏。
  if (!isCheckingActive()) {
    detectionTimer = null;
    clearDecorations();
    return;
  }

  if (immediate) {
    void detectActiveElement();
    return;
  }

  // 正在编辑输入：收缩为 20x20 主题色实心圆点，待停顿后再检测。
  setLauncherEditing(true);
  detectionTimer = window.setTimeout(() => {
    void detectActiveElement();
  }, 300);
}

function refreshDecorations(): void {
  if (!state.activeElement) {
    return;
  }

  if (state.activeIssues.length === 0) {
    updateLauncher();
    return;
  }

  renderMarks();
}

async function replaceIssue(issue: Issue): Promise<void> {
  if (!state.activeElement) {
    return;
  }

  const suggestion = issue.suggestions.find((item) => item.isDefault) ?? issue.suggestions[0];
  if (!suggestion) {
    return;
  }

  const changed = applyIssueSuggestion(state.activeElement, issue, suggestion.value);
  if (changed) {
    ensureIgnoredSet(state.activeElement).delete(issue.id);
    hideSuggestionPopover();
    await detectActiveElement(true);
  }
}

async function ignoreIssue(issue: Issue): Promise<void> {
  if (!state.activeElement) {
    return;
  }

  ensureIgnoredSet(state.activeElement).add(issue.id);
  hideSuggestionPopover();
  await detectActiveElement(true);
}

async function allowIssue(issue: Issue): Promise<void> {
  const nextAllowTerms = Array.from(
    new Set([
      ...settings.userDictionary.allowTerms[settings.defaultVariant],
      issue.sourceText,
    ]),
  );

  settings = (await browser.runtime.sendMessage({
    type: "settings/update",
    patch: {
      userDictionary: {
        allowTerms: {
          [settings.defaultVariant]: nextAllowTerms,
        },
      },
    },
  })) as ExtensionSettings;

  hideSuggestionPopover();
  await detectActiveElement(true);
}

function onFocusIn(event: FocusEvent): void {
  if (!uiReady || isExtensionUiTarget(event.target)) {
    return;
  }

  if (!isEditableElement(event.target)) {
    setActiveElement(null);
    state.activeIssues = [];
    clearDecorations();
    return;
  }

  setActiveElement(event.target);
  scheduleDetection(false);
}

function onInput(event: Event): void {
  if (!uiReady || !state.activeElement || event.target !== state.activeElement) {
    return;
  }

  scheduleDetection(false);
}

function onPaste(event: ClipboardEvent): void {
  if (!uiReady || !state.activeElement || event.target !== state.activeElement) {
    return;
  }

  scheduleDetection(true);
}

const MAX_SELECTION_LENGTH = 20000;
const MAX_FULLTEXT_LENGTH = 20000;

interface SelectionInfo {
  text: string;
  rect: RectLike;
  editableTarget: SupportedEditable | null;
}

function getSelectionInfo(): SelectionInfo | null {
  const active = document.activeElement;

  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (start === end) {
      return null;
    }
    const text = active.value.slice(start, end);
    if (!text.trim()) {
      return null;
    }
    const rect = getSelectionRect();
    if (!rect) {
      return null;
    }
    return { text, rect, editableTarget: active };
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const anchorNode = selection.anchorNode;
  if (anchorNode && ensureSelectionToolbar().contains(anchorNode)) {
    return null;
  }

  const text = selection.toString();
  if (!text.trim()) {
    return null;
  }

  const rect = getSelectionRect();
  if (!rect) {
    return null;
  }

  let editableTarget: SupportedEditable | null = null;
  if (anchorNode) {
    const element =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : anchorNode.parentElement;
    if (element?.isContentEditable) {
      editableTarget = element;
    }
  }

  return { text, rect, editableTarget };
}

function evaluateSelection(): void {
  if (!settings.enabled || !isSiteEnabled(settings, location.hostname) || !settings.showOnSelection) {
    hideSelectionToolbar();
    return;
  }

  const info = getSelectionInfo();
  if (!info) {
    hideSelectionToolbar();
    return;
  }

  if (!containsCjk(info.text) || info.text.length > MAX_SELECTION_LENGTH) {
    hideSelectionToolbar();
    return;
  }

  showSelectionToolbar({
    text: info.text,
    settings,
    anchorRect: info.rect,
    editableTarget: info.editableTarget,
    onAfterReplace: () => {
      void detectActiveElement(true);
    },
  });
}

function onMouseUp(event: MouseEvent): void {
  if (!uiReady || event.button !== 0) {
    return;
  }
  if (isExtensionUiTarget(event.target)) {
    return;
  }
  window.setTimeout(evaluateSelection, 0);
}

function onTouchEnd(event: TouchEvent): void {
  if (!uiReady || isExtensionUiTarget(event.target)) {
    return;
  }
  window.setTimeout(evaluateSelection, 0);
}

function onSelectionChange(): void {
  if (!uiReady) {
    return;
  }

  if (isSelectionToolbarOpen()) {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
      if ((active.selectionStart ?? 0) === (active.selectionEnd ?? 0)) {
        hideSelectionToolbar();
      }
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      hideSelectionToolbar();
    }
    return;
  }

  // reviewView 可见时，跟随正文中光标 / 选区切换对应 page。
  if (isReviewViewOpen() && state.activeElement) {
    syncReviewToCaret();
  }
}

function onScrollOrResize(event: Event): void {
  if (!uiReady) {
    return;
  }

  // 标记有待处理的更新
  pendingScrollUpdate = true;

  // 如果已经有 RAF 调度，直接返回（节流）
  if (scrollRafId) {
    return;
  }

  // 使用 requestAnimationFrame 将更新合并到下一帧
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;

    if (pendingScrollUpdate) {
      pendingScrollUpdate = false;

      // 区分 scroll 和 resize 事件处理
      if (event.type === 'resize') {
        // resize 事件：尺寸可能变化，需要强制刷新所有装饰
        refreshDecorations();
        repositionSelectionToolbar();
        repositionSuggestionPopover();
      } else {
        // scroll 事件：利用 position: absolute 自动跟随特性
        // 所有使用 absolute 定位的浮层（launcher、marks、popover、toolbar）都会自动跟随文档滚动
        // 因此页面级滚动时无需手动更新它们的位置
        //
        // 注意：只有以下情况需要处理：
        // 1. 文本框内部滚动（如 textarea 滚动）→ 标注位置可能变化 → 但这种情况极少
        // 2. 选区位置变化 → selectionToolbar 需要更新
        //
        // 当前策略：scroll 事件时不做任何浮层更新，避免性能问题
        // 如果将来发现文本框内部滚动导致标注错位，可在此处添加轻量级的位置检测
      }
    }
  });
}

async function dispatchShortcut(action: ShortcutAction): Promise<void> {
  switch (action) {
    case "toggleEnabled":
      await browser.runtime.sendMessage({
        type: "settings/update",
        patch: { enabled: !settings.enabled },
      });
      return;
    case "toggleReviewView":
      if (!settings.enabled || !isSiteEnabled(settings, location.hostname)) {
        return;
      }
      toggleReviewView();
      return;
    case "convertSelection":
      if (!settings.enabled || !isSiteEnabled(settings, location.hostname)) {
        return;
      }
      {
        const info = getSelectionInfo();
        if (info && info.editableTarget) {
          const converted = convertText(info.text, settings);
          if (replaceSelectionInEditable(info.editableTarget, converted)) {
            await detectActiveElement(true);
          }
        }
      }
      return;
    case "acceptNext":
      if (!settings.enabled || !isSiteEnabled(settings, location.hostname)) {
        return;
      }
      await acceptAndAdvance();
      return;
    default:
      return;
  }
}

// When several actions share the same shortcut combo, this ordered list decides
// which one fires: the first *applicable* action in this list wins. This is the
// contextual disambiguation — a combo bound to multiple actions triggers the one
// that makes sense for the current page state (à la Grammarly), instead of
// silently favouring a fixed declaration order.
const SHORTCUT_DISPATCH_PRIORITY: ShortcutAction[] = [
  "convertSelection", // most context-specific: a text selection exists
  "acceptNext", // there is an issue to act on / review view open
  "toggleReviewView", // detection active for this site
  "toggleEnabled", // global meta toggle, always available as a fallback
];

function isActionApplicable(action: ShortcutAction): boolean {
  switch (action) {
    case "toggleEnabled":
      return true;
    case "toggleReviewView":
      return settings.enabled && isSiteEnabled(settings, location.hostname);
    case "convertSelection":
      return (
        settings.enabled &&
        isSiteEnabled(settings, location.hostname) &&
        Boolean(getSelectionInfo()?.editableTarget)
      );
    case "acceptNext":
      return uiReady && (state.activeIssues.length > 0 || isReviewViewOpen());
    default:
      return false;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (uiReady && (isExtensionUiTarget(event.target) || isSettingsViewOpen())) {
    return;
  }

  const shortcuts = settings.shortcuts;
  const matchedActions = (Object.keys(shortcuts) as ShortcutAction[]).filter((action) =>
    matchCombo(event, shortcuts[action]),
  );

  if (matchedActions.length === 0) {
    return;
  }

  // Resolve a collision by contextual priority: among the actions whose combo
  // matched, pick the highest-priority one that is meaningful right now.
  const action =
    SHORTCUT_DISPATCH_PRIORITY.find(
      (candidate) => matchedActions.includes(candidate) && isActionApplicable(candidate),
    ) ?? matchedActions[0];

  event.preventDefault();
  event.stopPropagation();
  void dispatchShortcut(action);
}

function onPointerDown(event: PointerEvent): void {
  if (!uiReady) {
    return;
  }

  const target = event.target as Node | null;
  const card = ensureSuggestionPopover();
  const layer = ensureMarkLayer();
  const launcher = ensureCvlLauncher();
  const panel = ensureReviewView();
  const selToolbar = ensureSelectionToolbar();
  const settingsView = ensureSettingsView();
  if (target && (card.contains(target) || layer.contains(target) || launcher.contains(target) || panel.contains(target) || selToolbar.contains(target) || settingsView.contains(target))) {
    return;
  }

  scheduleHideSuggestionPopover();
  collapseLauncher();
  hideSelectionToolbar();
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main: async () => {
    settings = await getSettings();
    setRegion(detectDefaultRegion());
    if (isCheckingActive()) {
      ensureUi();
    }
    state.actions = {
      replace: replaceIssue,
      ignore: ignoreIssue,
      allow: allowIssue,
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("scroll", onScrollOrResize, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("selectionchange", onSelectionChange, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onScrollOrResize);

    // 监听持久化设置，而非由后台脚本枚举并向所有标签页发消息。这样既能让
    // 每个已注入的页面及时更新，也不需要 `tabs` 的全标签页读取权限。
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) {
        return;
      }

      void getSettings().then((nextSettings) => {
        settings = nextSettings;
        setRegion(detectDefaultRegion());
        if (!uiReady && isCheckingActive()) {
          ensureUi();
          // 站点刚开启时，已聚焦的编辑区错过了 focusin，这里补上。
          if (isEditableElement(document.activeElement)) {
            setActiveElement(document.activeElement);
          }
        }
        if (!uiReady) {
          return;
        }
        void detectActiveElement(true);
        evaluateSelection();
      });
    });
  },
});
