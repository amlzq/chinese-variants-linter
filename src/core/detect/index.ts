import type {
  DetectTextOptions,
  Issue,
  ScriptRule,
  Suggestion,
  VariantCode,
  VariantTermRule,
} from "../../shared/types";
import { getScriptSuggestion, loadRuleBundle } from "../rules";
import { getVariantLabel, t } from "../../shared/locale";

interface RankedIssue {
  issue: Issue;
  priority: number;
}

function isRangeCoveredByAllowedTerm(
  text: string,
  start: number,
  end: number,
  allowTerms: Set<string>,
): boolean {
  for (const term of allowTerms) {
    if (!term) {
      continue;
    }

    let searchIndex = 0;
    while (searchIndex < text.length) {
      const index = text.indexOf(term, searchIndex);
      if (index === -1) {
        break;
      }

      const termEnd = index + term.length;
      if (index <= start && end <= termEnd) {
        return true;
      }

      searchIndex = index + Math.max(1, term.length);
    }
  }

  return false;
}

function sortCandidates(candidates: RankedIssue[]): RankedIssue[] {
  return candidates.sort((left, right) => {
    if (left.issue.start !== right.issue.start) {
      return left.issue.start - right.issue.start;
    }

    const leftLength = left.issue.end - left.issue.start;
    const rightLength = right.issue.end - right.issue.start;
    if (leftLength !== rightLength) {
      return rightLength - leftLength;
    }

    return right.priority - left.priority;
  });
}

function overlaps(left: Issue, right: Issue): boolean {
  return left.start < right.end && right.start < left.end;
}

function pickNonOverlapping(candidates: RankedIssue[]): RankedIssue[] {
  const selected: RankedIssue[] = [];

  for (const candidate of sortCandidates(candidates)) {
    const conflict = selected.find((item) => overlaps(item.issue, candidate.issue));
    if (!conflict) {
      selected.push(candidate);
      continue;
    }

    if (
      conflict.issue.start === candidate.issue.start &&
      conflict.issue.end === candidate.issue.end &&
      candidate.priority > conflict.priority
    ) {
      const index = selected.indexOf(conflict);
      selected.splice(index, 1, candidate);
    }
  }

  return sortCandidates(selected);
}

function createSuggestion(target: string, explanation: string): Suggestion {
  return {
    value: target,
    label: t("detect.suggestion.label", { target }),
    explanation,
    isDefault: true,
  };
}

function buildTermIssue(
  rule: VariantTermRule,
  targetVariant: VariantCode,
  sourceText: string,
  replacement: string,
  start: number,
): RankedIssue {
  return {
    priority: rule.priority,
    issue: {
      id: `${rule.id}:${start}:${start + sourceText.length}:${targetVariant}`,
      type: "variant_term",
      subtype: rule.source === "user" ? "user-force-replace" : "builtin-term",
      sourceText,
      targetVariant,
      start,
      end: start + sourceText.length,
      confidence: rule.safe ? "high" : "medium",
      message: t("detect.termMessage", {
        variant: getVariantLabel(targetVariant),
        target: replacement,
      }),
      explanation:
        rule.source === "user"
          ? t("detect.explain.userForce")
          : t("detect.explain.builtinTerm"),
      suggestions: [createSuggestion(replacement, t("detect.suggestion.term"))],
      ruleId: rule.id,
      replaceMode: "single-only",
      status: "active",
    },
  };
}

function buildScriptIssue(
  rule: ScriptRule,
  targetVariant: VariantCode,
  replacement: string,
  start: number,
): RankedIssue {
  return {
    priority: rule.priority,
    issue: {
      id: `${rule.id}:${start}:${start + rule.from.length}:${targetVariant}`,
      type: "script",
      subtype: rule.contextSensitive ? "context-sensitive-char" : "safe-char",
      sourceText: rule.from,
      targetVariant,
      start,
      end: start + rule.from.length,
      confidence: rule.contextSensitive ? "medium" : "high",
      message: t("detect.scriptMessage", {
        variant: getVariantLabel(targetVariant),
        target: replacement,
      }),
      explanation: rule.contextSensitive
        ? t("detect.explain.contextScript")
        : t("detect.explain.safeScript"),
      suggestions: [createSuggestion(replacement, t("detect.suggestion.script"))],
      ruleId: rule.id,
      replaceMode: "single-only",
      status: "active",
    },
  };
}

function detectVariantTerms(
  text: string,
  targetVariant: VariantCode,
  rules: VariantTermRule[],
  allowTerms: Set<string>,
  ignoredIssueIds: Set<string>,
): RankedIssue[] {
  const sortedRules = [...rules].sort((left, right) => {
    const lengthDelta = right.sourceTerm.length - left.sourceTerm.length;
    if (lengthDelta !== 0) {
      return lengthDelta;
    }

    return right.priority - left.priority;
  });
  const matches: RankedIssue[] = [];

  for (const rule of sortedRules) {
    const replacement = rule.targets[targetVariant];
    if (!replacement || replacement === rule.sourceTerm || allowTerms.has(rule.sourceTerm)) {
      continue;
    }

    let searchIndex = 0;
    while (searchIndex < text.length) {
      const index = text.indexOf(rule.sourceTerm, searchIndex);
      if (index === -1) {
        break;
      }

      const rankedIssue = buildTermIssue(
        rule,
        targetVariant,
        rule.sourceTerm,
        replacement,
        index,
      );
      if (!ignoredIssueIds.has(rankedIssue.issue.id)) {
        matches.push(rankedIssue);
      }

      searchIndex = index + Math.max(1, rule.sourceTerm.length);
    }
  }

  return matches;
}

function detectScriptIssues(
  text: string,
  targetVariant: VariantCode,
  rules: ScriptRule[],
  allowTerms: Set<string>,
  ignoredIssueIds: Set<string>,
): RankedIssue[] {
  const matches: RankedIssue[] = [];

  for (const rule of rules) {
    const replacement = getScriptSuggestion(rule, targetVariant);
    if (!replacement || replacement === rule.from || allowTerms.has(rule.from)) {
      continue;
    }

    let searchIndex = 0;
    while (searchIndex < text.length) {
      const index = text.indexOf(rule.from, searchIndex);
      if (index === -1) {
        break;
      }

      if (
        isRangeCoveredByAllowedTerm(
          text,
          index,
          index + rule.from.length,
          allowTerms,
        )
      ) {
        searchIndex = index + Math.max(1, rule.from.length);
        continue;
      }

      const rankedIssue = buildScriptIssue(rule, targetVariant, replacement, index);
      if (!ignoredIssueIds.has(rankedIssue.issue.id)) {
        matches.push(rankedIssue);
      }

      searchIndex = index + Math.max(1, rule.from.length);
    }
  }

  return matches;
}

export function detectText({ text, settings, ignoredIssueIds = [] }: DetectTextOptions): Issue[] {
  if (!text.trim()) {
    return [];
  }

  const ignored = new Set(ignoredIssueIds);
  const bundle = loadRuleBundle(settings, settings.defaultVariant);
  const termCandidates =
    settings.detectionLevel === "standard"
      ? pickNonOverlapping(
        detectVariantTerms(
          text,
          settings.defaultVariant,
          bundle.termRules,
          bundle.allowTerms,
          ignored,
        ),
      )
      : [];

  const issues = [...termCandidates];
  const occupied = issues.map((item) => item.issue);

  const scriptCandidates = pickNonOverlapping(
    detectScriptIssues(
      text,
      settings.defaultVariant,
      bundle.scriptRules,
      bundle.allowTerms,
      ignored,
    ),
  );

  for (const candidate of scriptCandidates) {
    const blocked = occupied.some((issue) => overlaps(issue, candidate.issue));
    if (!blocked) {
      issues.push(candidate);
    }
  }

  return sortCandidates(issues).map((item) => item.issue);
}
