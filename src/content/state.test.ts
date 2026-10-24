import { beforeEach, describe, expect, it } from "vitest";
import type { Issue } from "../shared/types";
import { ensureIgnoredSet, findIssueById, getPrimaryRect, state } from "./state";

function createIssue(id: string): Issue {
  return {
    id,
    type: "script",
    subtype: "safe-char",
    sourceText: "软",
    targetVariant: "zh-TW",
    start: 0,
    end: 1,
    confidence: "high",
    message: "message",
    suggestions: [{ value: "軟", label: "label", isDefault: true }],
    ruleId: "rule",
    replaceMode: "single-only",
    status: "active",
  };
}

beforeEach(() => {
  state.activeElement = null;
  state.activeIssues = [];
  state.popoverIssueId = null;
  state.issueRectMap = new Map();
  state.ignoredIssueIds = new WeakMap();
  state.actions = null;
});

describe("findIssueById", () => {
  it("命中时返回对应 issue", () => {
    const issue = createIssue("a");
    state.activeIssues = [issue, createIssue("b")];
    expect(findIssueById("b")?.id).toBe("b");
  });

  it("未命中返回 undefined", () => {
    state.activeIssues = [createIssue("a")];
    expect(findIssueById("missing")).toBeUndefined();
  });
});

describe("getPrimaryRect", () => {
  it("返回首个矩形", () => {
    state.issueRectMap.set("a", [
      { left: 0, top: 0, right: 10, bottom: 5, width: 10, height: 5 },
      { left: 0, top: 10, right: 10, bottom: 15, width: 10, height: 5 },
    ]);
    expect(getPrimaryRect("a")?.top).toBe(0);
  });

  it("无记录或空数组返回 null", () => {
    expect(getPrimaryRect("none")).toBeNull();
    state.issueRectMap.set("empty", []);
    expect(getPrimaryRect("empty")).toBeNull();
  });
});

describe("ensureIgnoredSet", () => {
  it("同一元素的集合保持唯一", () => {
    const element = document.createElement("textarea");
    const first = ensureIgnoredSet(element);
    const second = ensureIgnoredSet(element);
    expect(first).toBe(second);
    first.add("issue");
    expect(second.has("issue")).toBe(true);
  });

  it("不同元素拥有独立集合", () => {
    const a = document.createElement("textarea");
    const b = document.createElement("textarea");
    ensureIgnoredSet(a).add("issue");
    expect(ensureIgnoredSet(b).has("issue")).toBe(false);
  });
});
