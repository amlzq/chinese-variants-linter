import * as OpenCC from "opencc-js";
import { SCRIPT_RULES, TERM_RULES } from "../../assets/rules";
import type {
  ExtensionSettings,
  ScriptRule,
  VariantCode,
  VariantTermRule,
} from "../../shared/types";

const converterCache = new Map<VariantCode, (value: string) => string>();

/**
 * 变体在界面中的展示顺序。新增变体时在此追加。
 */
const VARIANT_DISPLAY_ORDER: VariantCode[] = [
  "zh-CN",
  "zh-TW",
  "zh-HK",
  "zh-Hant",
];

/**
 * 从项目自身规则表推导真正支持的目标变体（去重），并按 VARIANT_DISPLAY_ORDER 排序。
 * 列表反映插件实际转换能力，新增规则时会自动同步。
 */
export function getSupportedVariants(): VariantCode[] {
  const set = new Set<VariantCode>();
  for (const rule of SCRIPT_RULES) {
    for (const variant of Object.keys(rule.toByVariant) as VariantCode[]) {
      set.add(variant);
    }
  }
  for (const rule of TERM_RULES) {
    for (const variant of Object.keys(rule.targets) as VariantCode[]) {
      set.add(variant);
    }
  }
  return [...set].sort(
    (a, b) => VARIANT_DISPLAY_ORDER.indexOf(a) - VARIANT_DISPLAY_ORDER.indexOf(b),
  );
}

function buildPairs(targetVariant: VariantCode): Array<[string, string]> {
  return SCRIPT_RULES.flatMap((rule) => {
    const replacement = rule.toByVariant[targetVariant];
    if (!replacement) {
      return [];
    }

    return [[rule.from, replacement] as [string, string]];
  });
}

export function getScriptConverter(targetVariant: VariantCode): (value: string) => string {
  const cached = converterCache.get(targetVariant);
  if (cached) {
    return cached;
  }

  const converter = OpenCC.CustomConverter(buildPairs(targetVariant)) as (value: string) => string;
  converterCache.set(targetVariant, converter);
  return converter;
}

export function convertTextToVariant(value: string, targetVariant: VariantCode): string {
  return getScriptConverter(targetVariant)(value);
}

export function getScriptSuggestion(
  rule: ScriptRule,
  targetVariant: VariantCode,
): string | null {
  return rule.toByVariant[targetVariant] ?? null;
}

function buildUserTermRules(
  settings: ExtensionSettings,
  targetVariant: VariantCode,
): VariantTermRule[] {
  return settings.userDictionary.forceReplaceRules
    .filter((rule) => rule.enabled && rule.variant === targetVariant)
    .map((rule, index) => ({
      id: rule.id || `user-force-${index}`,
      kind: "variant_term" as const,
      sourceTerm: rule.from,
      targets: {
        [rule.variant]: rule.to,
      },
      safe: true,
      enabled: true,
      priority: 10_000,
      source: "user" as const,
      tags: ["force-replace"],
    }));
}

export interface RuleBundle {
  scriptRules: ScriptRule[];
  termRules: VariantTermRule[];
  allowTerms: Set<string>;
}

export function loadRuleBundle(
  settings: ExtensionSettings,
  targetVariant: VariantCode,
): RuleBundle {
  const builtinScriptRules = SCRIPT_RULES.filter(
    (rule) => rule.enabled && Boolean(rule.toByVariant[targetVariant]),
  );
  const builtinTermRules = TERM_RULES.filter(
    (rule) => rule.enabled && Boolean(rule.targets[targetVariant]),
  );
  const userTermRules = buildUserTermRules(settings, targetVariant);

  return {
    scriptRules: builtinScriptRules,
    termRules: [...userTermRules, ...builtinTermRules],
    allowTerms: new Set(settings.userDictionary.allowTerms[targetVariant]),
  };
}
