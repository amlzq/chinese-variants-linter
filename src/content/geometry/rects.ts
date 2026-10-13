import type { SupportedEditable } from "../../core/apply";
import type { Issue } from "../../shared/types";

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function normalizeRect(rect: DOMRect): RectLike {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function isTextControl(
  element: SupportedEditable,
): element is HTMLTextAreaElement | HTMLInputElement {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
}

function copyMirrorStyles(source: CSSStyleDeclaration, mirror: HTMLElement): void {
  const properties = [
    "boxSizing",
    "width",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderTopStyle",
    "borderRightStyle",
    "borderBottomStyle",
    "borderLeftStyle",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontVariant",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "textAlign",
    "textIndent",
    "textDecoration",
    "textRendering",
    "tabSize",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
    "wordSpacing",
    "direction",
  ] as const;

  for (const property of properties) {
    mirror.style[property] = source[property];
  }
}

export function getTextControlRects(
  element: HTMLTextAreaElement | HTMLInputElement,
  issue: Issue,
): RectLike[] {
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  const mirror = document.createElement("div");

  copyMirrorStyles(computed, mirror);
  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.overflowX = computed.overflowX === "visible" ? "auto" : computed.overflowX;
  mirror.style.overflowY = computed.overflowY === "visible" ? "auto" : computed.overflowY;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.background = "transparent";
  mirror.style.color = "transparent";
  mirror.style.whiteSpace = element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";

  const before = document.createTextNode(element.value.slice(0, issue.start));
  const target = document.createElement("span");
  target.textContent = element.value.slice(issue.start, issue.end) || issue.sourceText || " ";
  const after = document.createTextNode(element.value.slice(issue.end));

  mirror.append(before, target, after);
  document.body.append(mirror);
  mirror.scrollTop = element.scrollTop;
  mirror.scrollLeft = element.scrollLeft;

  const rects = Array.from(target.getClientRects())
    .filter((item) => item.width > 0 && item.height > 0)
    .map(normalizeRect);

  mirror.remove();
  return rects;
}

function locateTextOffset(root: HTMLElement, targetOffset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let traversed = 0;
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const current = walker.currentNode as Text;
    const length = current.data.length;
    if (targetOffset <= traversed + length) {
      return {
        node: current,
        offset: targetOffset - traversed,
      };
    }

    traversed += length;
    lastTextNode = current;
  }

  return lastTextNode
    ? {
      node: lastTextNode,
      offset: lastTextNode.data.length,
    }
    : null;
}

export function getContenteditableRects(element: HTMLElement, issue: Issue): RectLike[] {
  const start = locateTextOffset(element, issue.start);
  const end = locateTextOffset(element, issue.end);
  if (!start || !end) {
    return [];
  }

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  return Array.from(range.getClientRects())
    .filter((item) => item.width > 0 && item.height > 0)
    .map(normalizeRect);
}

export function measureIssueRects(element: SupportedEditable, issue: Issue): RectLike[] {
  if (isTextControl(element)) {
    return getTextControlRects(element, issue);
  }

  return getContenteditableRects(element, issue);
}

export function unionRects(rects: RectLike[]): RectLike | null {
  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export function getTextControlSelectionRect(
  element: HTMLTextAreaElement | HTMLInputElement,
): RectLike | null {
  const start = element.selectionStart ?? 0;
  const end = element.selectionEnd ?? 0;
  if (start === end) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  const mirror = document.createElement("div");

  copyMirrorStyles(computed, mirror);
  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.overflowX = computed.overflowX === "visible" ? "auto" : computed.overflowX;
  mirror.style.overflowY = computed.overflowY === "visible" ? "auto" : computed.overflowY;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.background = "transparent";
  mirror.style.color = "transparent";
  mirror.style.whiteSpace = element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";

  const before = document.createTextNode(element.value.slice(0, start));
  const target = document.createElement("span");
  target.textContent = element.value.slice(start, end) || " ";
  const after = document.createTextNode(element.value.slice(end));

  mirror.append(before, target, after);
  document.body.append(mirror);
  mirror.scrollTop = element.scrollTop;
  mirror.scrollLeft = element.scrollLeft;

  const rects = Array.from(target.getClientRects())
    .filter((item) => item.width > 0 && item.height > 0)
    .map(normalizeRect);

  mirror.remove();
  return unionRects(rects);
}

export function getRangeSelectionRect(): RectLike | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rects = Array.from(range.getClientRects())
    .filter((item) => item.width > 0 && item.height > 0)
    .map(normalizeRect);

  return unionRects(rects);
}

export function getSelectionRect(): RectLike | null {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    return getTextControlSelectionRect(active);
  }
  return getRangeSelectionRect();
}

/**
 * 返回当前选区在元素文本坐标（与 getEditableText 一致）中的起止偏移。
 * 光标态（无选區）时返回 start === end 的折叠位置，可用于跟随光标。
 * 选区不在该元素内时返回 null。
 */
export function getSelectionOffsets(
  element: SupportedEditable,
): { start: number; end: number } | null {
  if (isTextControl(element)) {
    return {
      start: element.selectionStart ?? 0,
      end: element.selectionEnd ?? 0,
    };
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (range.startContainer !== element && !element.contains(range.startContainer)) {
    return null;
  }

  const beforeStart = document.createRange();
  beforeStart.selectNodeContents(element);
  beforeStart.setEnd(range.startContainer, range.startOffset);
  const start = beforeStart.toString().length;

  const beforeEnd = document.createRange();
  beforeEnd.selectNodeContents(element);
  beforeEnd.setEnd(range.endContainer, range.endOffset);
  const end = beforeEnd.toString().length;

  return { start, end };
}
