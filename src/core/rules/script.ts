import * as OpenCC from "opencc-js";
import type { VariantCode } from "../../shared/types";

type Converter = (value: string) => string;
type DictGroup = readonly (string | readonly (readonly [string, string])[])[];

const { Locale } = OpenCC;

/**
 * 各目标变体的字形转换管线，基于 OpenCC 完整字典（含词组字典，可按上下文消歧）。
 *
 * 繁体目标先统一转为简体，再由简体转到目标：繁体输入中合法的简繁同形字
 * （如「干擾」「里長」「若干」）若直接套用「简→繁」字典，会被误转为「幹擾」「裡長」。
 * 先转简体再借助词组字典恢复，可让已符合目标的文本保持不变。
 */
let toSimplified: Converter | null = null;
const converterCache = new Map<VariantCode, Converter>();

function getToSimplified(): Converter {
  // 台湾、香港异体先归一到 OpenCC 标准繁体，再转简体。
  toSimplified ??= OpenCC.ConverterFactory(Locale.from.tw, Locale.from.hk, Locale.to.cn);
  return toSimplified;
}

function buildFromSimplified(targetVariant: Exclude<VariantCode, "zh-CN">): Converter {
  switch (targetVariant) {
    case "zh-TW":
      return OpenCC.ConverterFactory(Locale.from.cn, Locale.to.tw);
    case "zh-HK":
      return OpenCC.ConverterFactory(Locale.from.cn, Locale.to.hk);
    case "zh-Hant":
      return OpenCC.ConverterFactory(Locale.from.cn);
  }
}

/**
 * 返回目标变体的字形转换函数。转换器在首次使用时创建（需构建字典树，约数十毫秒），
 * 之后复用；未开启检查的页面不会付出这部分开销。
 */
export function getScriptConverter(targetVariant: VariantCode): Converter {
  const cached = converterCache.get(targetVariant);
  if (cached) {
    return cached;
  }

  const simplify = getToSimplified();
  let converter: Converter;
  if (targetVariant === "zh-CN") {
    converter = simplify;
  } else {
    const fromSimplified = buildFromSimplified(targetVariant);
    converter = (value) => fromSimplified(simplify(value));
  }

  converterCache.set(targetVariant, converter);
  return converter;
}

export function convertTextToVariant(value: string, targetVariant: VariantCode): string {
  return getScriptConverter(targetVariant)(value);
}

/**
 * 目标变体中可接受、不应报告的「原字 → 转换结果」。
 * OpenCC 台湾标准使用「臺」，但「台灣」「台北」在台湾同样通行，报告会造成大量误报。
 */
const TOLERATED_CHANGES: Partial<Record<VariantCode, ReadonlyMap<string, string>>> = {
  "zh-TW": new Map([["台", "臺"]]),
};

function parseDict(dict: DictGroup[number]): Array<[string, string]> {
  if (typeof dict !== "string") {
    return dict.map(([source, target]) => [source, target]);
  }

  return dict
    .split("|")
    .filter(Boolean)
    .map((entry) => {
      const [source = "", target = ""] = entry.split(" ");
      return [source, target];
    });
}

/**
 * 从 OpenCC 词组字典推导「一对多」字：只要某字在词组中的转换结果与单字默认结果不同，
 * 就说明它的转换依赖上下文（如「后」在「皇后」中不转、「面」在「面条」中转为「麵」）。
 */
function buildAmbiguousChars(groups: readonly DictGroup[]): Set<string> {
  const ambiguous = new Set<string>();

  for (const group of groups) {
    const charDict = group[group.length - 1];
    if (!charDict) {
      continue;
    }

    const charMap = new Map(parseDict(charDict));
    for (const phraseDict of group.slice(0, -1)) {
      for (const [source, target] of parseDict(phraseDict)) {
        const sourceChars = [...source];
        const targetChars = [...target];
        if (sourceChars.length !== targetChars.length) {
          continue;
        }

        sourceChars.forEach((char, index) => {
          if (targetChars[index] !== (charMap.get(char) ?? char)) {
            ambiguous.add(char);
          }
        });
      }
    }
  }

  return ambiguous;
}

let simplifiedAmbiguous: Set<string> | null = null;
let traditionalAmbiguous: Set<string> | null = null;

/**
 * 判断一段字形转换是否依赖上下文。繁体目标的转换经由简体中转，
 * 因此以原文的简体形式查询「简→繁」方向的一对多字表。
 */
function isContextSensitive(source: string, targetVariant: VariantCode): boolean {
  if (targetVariant === "zh-CN") {
    traditionalAmbiguous ??= buildAmbiguousChars(Locale.to.cn);
    return [...source].some((char) => traditionalAmbiguous!.has(char));
  }

  simplifiedAmbiguous ??= buildAmbiguousChars(Locale.from.cn);
  return [...getToSimplified()(source)].some((char) => simplifiedAmbiguous!.has(char));
}

function isLowSurrogate(value: string, index: number): boolean {
  const code = value.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff;
}

export interface ScriptChange {
  start: number;
  end: number;
  source: string;
  target: string;
  contextSensitive: boolean;
}

/**
 * 比较原文与 OpenCC 转换结果，返回需要修改的字形片段（UTF-16 下标）。
 * 字形转换通常逐字等长，此时逐字比对；长度不一致时退化为首尾对齐后的单个差异片段。
 */
export function findScriptChanges(text: string, targetVariant: VariantCode): ScriptChange[] {
  const converted = convertTextToVariant(text, targetVariant);
  if (converted === text) {
    return [];
  }

  const tolerated = TOLERATED_CHANGES[targetVariant];
  const sourceChars = [...text];
  const targetChars = [...converted];
  const changes: Array<Omit<ScriptChange, "contextSensitive">> = [];

  if (sourceChars.length === targetChars.length) {
    let offset = 0;
    sourceChars.forEach((char, index) => {
      const target = targetChars[index]!;
      if (char !== target && tolerated?.get(char) !== target) {
        changes.push({ start: offset, end: offset + char.length, source: char, target });
      }
      offset += char.length;
    });
  } else {
    let prefix = 0;
    while (prefix < text.length && text[prefix] === converted[prefix]) {
      prefix++;
    }
    let suffix = 0;
    while (
      suffix < text.length - prefix &&
      suffix < converted.length - prefix &&
      text[text.length - 1 - suffix] === converted[converted.length - 1 - suffix]
    ) {
      suffix++;
    }
    // 不在代理对中间切分，避免产生半个字符。
    if (prefix > 0 && isLowSurrogate(text, prefix)) {
      prefix--;
    }
    if (suffix > 0 && isLowSurrogate(text, text.length - suffix)) {
      suffix--;
    }
    changes.push({
      start: prefix,
      end: text.length - suffix,
      source: text.slice(prefix, text.length - suffix),
      target: converted.slice(prefix, converted.length - suffix),
    });
  }

  return changes.map((change) => ({
    ...change,
    contextSensitive: isContextSensitive(change.source, targetVariant),
  }));
}
