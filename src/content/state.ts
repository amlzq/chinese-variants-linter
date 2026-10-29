import type { SupportedEditable } from "../core/apply";
import type { Issue } from "../shared/types";
import type { RectLike } from "./geometry/rects";

export interface ActionHandlers {
  replace: (issue: Issue) => Promise<void>;
  ignore: (issue: Issue) => Promise<void>;
  allow: (issue: Issue) => Promise<void>;
  replaceAll: () => Promise<void>;
}

/**
 * 跨模块共享的可变状态。各 UI 模块与编排层均通过此对象读写，
 * 避免散落的模块级变量与循环传参。
 */
export const state = {
  activeElement: null as SupportedEditable | null,
  activeIssues: [] as Issue[],
  popoverIssueId: null as string | null,
  issueRectMap: new Map<string, RectLike[]>(),
  ignoredIssueIds: new WeakMap<SupportedEditable, Set<string>>(),
  actions: null as ActionHandlers | null,
};

export function ensureIgnoredSet(element: SupportedEditable): Set<string> {
  let ids = state.ignoredIssueIds.get(element);
  if (!ids) {
    ids = new Set<string>();
    state.ignoredIssueIds.set(element, ids);
  }

  return ids;
}

export function findIssueById(issueId: string): Issue | undefined {
  return state.activeIssues.find((issue) => issue.id === issueId);
}

export function getPrimaryRect(issueId: string): RectLike | null {
  const rects = state.issueRectMap.get(issueId);
  return rects && rects.length > 0 ? rects[0] : null;
}
