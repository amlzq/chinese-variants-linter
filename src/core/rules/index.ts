import { TERM_RULES } from "../../assets/rules";
import type {
  ExtensionSettings,
  VariantCode,
  VariantTermRule,
} from "../../shared/types";

/**
 * 支持的目标变体及其在界面中的展示顺序。字形转换由 OpenCC 完整字典提供，
 * 四种变体均可转换；新增变体时在此追加，并在 ./script 中补充对应管线。
 *
 * 本模块不引用 ./script：弹窗只需要变体列表，避免把 OpenCC 字典打进弹窗包。
 */
const VARIANT_DISPLAY_ORDER: VariantCode[] = [
  "zh-CN",
  "zh-TW",
  "zh-HK",
  "zh-Hant",
];

export function getSupportedVariants(): VariantCode[] {
  return [...VARIANT_DISPLAY_ORDER];
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
  termRules: VariantTermRule[];
  allowTerms: Set<string>;
}

export function loadRuleBundle(
  settings: ExtensionSettings,
  targetVariant: VariantCode,
): RuleBundle {
  const builtinTermRules = TERM_RULES.filter(
    (rule) => rule.enabled && Boolean(rule.targets[targetVariant]),
  );
  const userTermRules = buildUserTermRules(settings, targetVariant);

  return {
    termRules: [...userTermRules, ...builtinTermRules],
    allowTerms: new Set(settings.userDictionary.allowTerms[targetVariant]),
  };
}
