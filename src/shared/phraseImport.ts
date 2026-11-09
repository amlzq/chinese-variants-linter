import { t } from "./locale";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_PHRASES_PER_VARIANT,
  decodePhraseFile,
  parsePhraseFile,
} from "./phraseCsv";
import { importPhrasesPatch } from "./settingsHelpers";
import type { ExtensionSettings, ExtensionSettingsPatch, VariantCode } from "./types";

/** 弹出系统文件选择器；页内面板与 popup 共用。 */
export function pickPhraseFile(onFile: (file: File) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.txt,.tsv,text/csv,text/plain";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) {
      onFile(file);
    }
  });
  input.click();
}

/**
 * 读取并解析导入文件，返回要应用的补丁；文件过大、读取失败或没有可导入内容时
 * 提示用户并返回 null。超出数量上限而被跳过的词组会提示数量，其余仍然导入。
 */
export async function importPhraseFile(
  file: File,
  settings: ExtensionSettings,
  variant: VariantCode,
): Promise<ExtensionSettingsPatch | null> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    window.alert(t("settings.dict.importTooLarge", { size: Math.round(MAX_IMPORT_FILE_BYTES / 1024) }));
    return null;
  }
  let text: string;
  try {
    text = decodePhraseFile(await file.arrayBuffer());
  } catch {
    window.alert(t("settings.dict.importFailed"));
    return null;
  }
  const { patch, added, updated, skipped } = importPhrasesPatch(settings, variant, parsePhraseFile(text));
  if (Object.keys(patch).length === 0) {
    window.alert(
      skipped > 0
        ? t("settings.dict.importPartial", { added, updated, skipped, max: MAX_PHRASES_PER_VARIANT })
        : t("settings.dict.importEmpty"),
    );
    return null;
  }
  if (skipped > 0) {
    window.alert(t("settings.dict.importPartial", { added, updated, skipped, max: MAX_PHRASES_PER_VARIANT }));
  }
  return patch;
}
