import type {
  ExtensionSettings,
  ExtensionSettingsPatch,
  CustomPhrase,
} from "./types";

/**
 * 计算「设置变更补丁」的纯函数集合。
 * popup 与页面内设置视图共用，避免两侧各自维护重复的数组操作逻辑。
 * 返回空对象 `{}` 表示无需变更（调用方应据此跳过写入）。
 */

export function allowTermsPatch(settings: ExtensionSettings, term: string): ExtensionSettingsPatch {
  const variant = settings.defaultVariant;
  const terms = settings.userDictionary.allowTerms[variant] ?? [];
  const next = term.trim();
  if (!next || terms.includes(next)) {
    return {};
  }
  return {
    userDictionary: {
      allowTerms: { [variant]: Array.from(new Set([...terms, next])) },
    },
  };
}

export function removeAllowTermPatch(
  settings: ExtensionSettings,
  term: string,
): ExtensionSettingsPatch {
  const variant = settings.defaultVariant;
  const terms = settings.userDictionary.allowTerms[variant] ?? [];
  return {
    userDictionary: {
      allowTerms: { [variant]: terms.filter((t) => t !== term) },
    },
  };
}

export function addPhrasePatch(
  settings: ExtensionSettings,
  from: string,
  to: string,
): ExtensionSettingsPatch {
  const variant = settings.defaultVariant;
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  if (!trimmedFrom || !trimmedTo) {
    return {};
  }
  const phrase: CustomPhrase = {
    id: `phrase-${Date.now()}`,
    from: trimmedFrom,
    to: trimmedTo,
    enabled: true,
  };
  return {
    userDictionary: {
      phrases: { [variant]: [...(settings.userDictionary.phrases[variant] ?? []), phrase] },
    },
  };
}

export function removePhrasePatch(
  settings: ExtensionSettings,
  id: string,
): ExtensionSettingsPatch {
  const variant = settings.defaultVariant;
  return {
    userDictionary: {
      phrases: {
        [variant]: (settings.userDictionary.phrases[variant] ?? []).filter((p) => p.id !== id),
      },
    },
  };
}
