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
