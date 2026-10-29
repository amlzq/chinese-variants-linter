import type { ExtensionSettings, Issue } from "../../shared/types";
import { detectText } from "../detect";

export type SupportedEditable = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

export function isSupportedInput(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement && ["text", "search"].includes(element.type);
}

export function isEditableElement(target: EventTarget | null): target is SupportedEditable {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target instanceof HTMLTextAreaElement || isSupportedInput(target) || target.isContentEditable;
}

export function getEditableText(element: SupportedEditable): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }

  return element.textContent ?? "";
}

function dispatchInputLikeEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function canReplaceIssue(element: SupportedEditable): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return true;
  }

  return (
    element.childNodes.length <= 1 &&
    (element.firstChild === null || element.firstChild.nodeType === Node.TEXT_NODE)
  );
}

export function applyIssueSuggestion(
  element: SupportedEditable,
  issue: Issue,
  replacement: string,
): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const value = element.value;
    const nextValue = `${value.slice(0, issue.start)}${replacement}${value.slice(issue.end)}`;
    const selectionStart = element.selectionStart ?? issue.end;
    const selectionEnd = element.selectionEnd ?? issue.end;
    const delta = replacement.length - (issue.end - issue.start);

    element.value = nextValue;
    element.setSelectionRange(
      Math.max(0, selectionStart + delta),
      Math.max(0, selectionEnd + delta),
    );
    dispatchInputLikeEvents(element);
    return true;
  }

  if (!canReplaceIssue(element)) {
    return false;
  }

  const value = getEditableText(element);
  const nextValue = `${value.slice(0, issue.start)}${replacement}${value.slice(issue.end)}`;
  element.textContent = nextValue;
  dispatchInputLikeEvents(element);
  return true;
}

function getDefaultReplacement(issue: Issue): string | null {
  const suggestion = issue.suggestions.find((item) => item.isDefault) ?? issue.suggestions[0];
  return suggestion ? suggestion.value : null;
}

/**
 * 一次性应用所有问题的默认建议。自后向前替换，保证前面的偏移不受影响；
 * 只写入一次、只派发一次 input/change，避免逐项替换时反复重新检测。
 * 返回实际替换的数量（不可替换的复杂编辑器返回 0）。
 */
export function applyAllSuggestions(element: SupportedEditable, issues: Issue[]): number {
  if (issues.length === 0 || !canReplaceIssue(element)) {
    return 0;
  }

  const original = getEditableText(element);
  // 先按位置升序剔除无建议项和与前一项重叠的问题（先出现者优先），再自后向前替换。
  const planned: Array<{ issue: Issue; replacement: string }> = [];
  let previousEnd = 0;
  for (const issue of [...issues].sort((a, b) => a.start - b.start)) {
    const replacement = getDefaultReplacement(issue);
    if (
      replacement === null ||
      issue.start < previousEnd ||
      issue.start < 0 ||
      issue.end > original.length ||
      issue.start >= issue.end
    ) {
      continue;
    }
    planned.push({ issue, replacement });
    previousEnd = issue.end;
  }

  // 光标/选区按各替换造成的长度变化平移。
  const isField = element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
  let selectionStart = isField ? (element.selectionStart ?? original.length) : 0;
  let selectionEnd = isField ? (element.selectionEnd ?? original.length) : 0;
  let next = original;
  let count = 0;

  for (const { issue, replacement } of planned.reverse()) {
    next = `${next.slice(0, issue.start)}${replacement}${next.slice(issue.end)}`;
    const delta = replacement.length - (issue.end - issue.start);
    if (selectionStart >= issue.end) {
      selectionStart += delta;
    } else if (selectionStart > issue.start) {
      selectionStart = issue.start + replacement.length;
    }
    if (selectionEnd >= issue.end) {
      selectionEnd += delta;
    } else if (selectionEnd > issue.start) {
      selectionEnd = issue.start + replacement.length;
    }
    count += 1;
  }

  if (count === 0) {
    return 0;
  }

  if (isField) {
    element.value = next;
    element.setSelectionRange(Math.max(0, selectionStart), Math.max(0, selectionEnd));
  } else {
    element.textContent = next;
  }
  dispatchInputLikeEvents(element);
  return count;
}

export function convertText(text: string, settings: ExtensionSettings): string {
  const issues = detectText({ text, settings });
  if (issues.length === 0) {
    return text;
  }

  let result = text;
  for (let i = issues.length - 1; i >= 0; i--) {
    const issue = issues[i];
    const suggestion = issue.suggestions.find((s) => s.isDefault) ?? issue.suggestions[0];
    if (!suggestion) {
      continue;
    }
    result = `${result.slice(0, issue.start)}${suggestion.value}${result.slice(issue.end)}`;
  }
  return result;
}

export function replaceSelectionInEditable(
  element: SupportedEditable,
  replacement: string,
): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    if (start === end) {
      return false;
    }

    const value = element.value;
    element.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    const caret = start + replacement.length;
    element.setSelectionRange(caret, caret);
    dispatchInputLikeEvents(element);
    return true;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(replacement);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  dispatchInputLikeEvents(element);
  return true;
}
