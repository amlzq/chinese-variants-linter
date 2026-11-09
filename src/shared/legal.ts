import privacyMarkdown from "../../PRIVACY.md?raw";
import termsMarkdown from "../../TERMS.md?raw";
import { getRegion, type Region } from "./locale";
import { renderMarkdown } from "./markdown";

export type LegalKind = "terms" | "privacy";

const SOURCES: Record<LegalKind, string> = {
  terms: termsMarkdown,
  privacy: privacyMarkdown,
};

/** 文档里的语言版本：简体、中文（台灣）、中文（香港）、英文。 */
type Language = "CN" | "TW" | "HK" | "EN";

interface Section {
  heading: string;
  lines: string[];
}

/** 界面地区对应的文档语言：澳门沿用香港版，新马等其余中文地区用简体版。 */
function languageOf(region: Region): Language {
  switch (region) {
    case "EN":
      return "EN";
    case "TW":
      return "TW";
    case "HK":
    case "MO":
      return "HK";
    default:
      return "CN";
  }
}

/** 语言版本章节的标题；不是这四个标题的章节不属于任何语言版本，被忽略。 */
function sectionLanguage(heading: string): Language | null {
  if (heading === "中文") return "CN";
  if (heading.startsWith("中文（台")) return "TW";
  if (heading.startsWith("中文（香")) return "HK";
  if (heading === "English") return "EN";
  return null;
}

function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      sections.push({ heading: h2[1].trim(), lines: [] });
    } else if (sections.length > 0) {
      // 第一个二级标题之前只有文档总标题，由页面头部显示，不进入正文。
      sections[sections.length - 1].lines.push(line);
    }
  }
  return sections;
}

/**
 * 取指定地区的 Markdown 正文：文档按「## 中文」「## 中文（台灣）」「## 中文（香港）」
 * 「## English」分语言版本，只保留与界面语言对应的那一版。
 * 每个版本自带完整内容（包括「联系 / 聯絡 / Contact」小节），不依赖共用章节。
 */
export function getLegalMarkdown(kind: LegalKind, region: Region = getRegion()): string {
  const language = languageOf(region);
  const out: string[] = [];
  for (const section of splitSections(SOURCES[kind])) {
    if (sectionLanguage(section.heading) === language) {
      out.push(...section.lines);
    }
  }
  return out.join("\n").trim();
}

export function getLegalHtml(kind: LegalKind, region: Region = getRegion()): string {
  return renderMarkdown(getLegalMarkdown(kind, region));
}
