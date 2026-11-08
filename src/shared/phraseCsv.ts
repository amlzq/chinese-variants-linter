/**
 * 自定义词组的 CSV 导入导出：两列 `from,to`，首行可选表头。
 * 支持引号包裹、转义引号（""）、字段内换行与 UTF-8 BOM（Excel 导出的常见形态）。
 */
import type { CustomPhrase } from "./types";

export const PHRASE_CSV_HEADER = ["from", "to"] as const;

/** 每个变体最多保存的自定义词组数；storage 归一化时也以此截断。 */
export const MAX_PHRASES_PER_VARIANT = 1000;
/** 导入文件大小上限（字节），避免误选超大文件。 */
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 解析 CSV，丢弃表头、空行及 from / to 任一为空的行。 */
export function parsePhraseCsv(text: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  parseCsvRows(text).forEach((cells, index) => {
    const from = (cells[0] ?? "").trim();
    const to = (cells[1] ?? "").trim();
    if (index === 0 && from.toLowerCase() === PHRASE_CSV_HEADER[0] && to.toLowerCase() === PHRASE_CSV_HEADER[1]) {
      return;
    }
    if (from && to) {
      out.push({ from: unguardFormula(from), to: unguardFormula(to) });
    }
  });
  return out;
}

/**
 * CSV 公式注入防护：以 = + - @ 开头的单元格在 Excel / Sheets 中会被当作公式，
 * 导出时前置一个单引号，导入时再去掉，保证往返一致。
 */
function guardFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function unguardFormula(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function escapeCsvField(raw: string): string {
  const value = guardFormula(raw);
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializePhraseCsv(phrases: Array<Pick<CustomPhrase, "from" | "to">>): string {
  const lines = [PHRASE_CSV_HEADER.join(",")];
  for (const phrase of phrases) {
    lines.push(`${escapeCsvField(phrase.from)},${escapeCsvField(phrase.to)}`);
  }
  // BOM 让 Excel 以 UTF-8 打开，避免中文乱码。
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const PHRASE_TEMPLATE_ROWS = [
  { from: "软件", to: "軟體" },
  { from: "视频", to: "影片" },
];

export function buildPhraseTemplateCsv(): string {
  return serializePhraseCsv(PHRASE_TEMPLATE_ROWS);
}

function dedupeKeepLast(rows: Array<{ from: string; to: string }>): Array<{ from: string; to: string }> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.from, row.to);
  }
  return [...map].map(([from, to]) => ({ from, to }));
}

/**
 * 解析 OpenCC 风格词条：每行 `原词<Tab>目标词`，`#` 开头为注释，
 * 目标词若有多个以空白分隔的候选只取第一个；原词重复时以最后一条为准。
 */
export function parseTabDictionary(text: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (const line of text.replace(/^﻿/, "").split(/\r\n|\n|\r/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }
    const tab = line.indexOf("\t");
    if (tab < 0) {
      continue;
    }
    const from = line.slice(0, tab).trim();
    const to = line.slice(tab + 1).trim().split(/\s+/)[0] ?? "";
    if (from && to) {
      out.push({ from, to });
    }
  }
  return dedupeKeepLast(out);
}

/**
 * 导入文件入口：含制表符的非注释行视为 OpenCC 词条格式（.txt / .tsv），
 * 否则按 CSV 解析。两种格式都忽略 `#` 注释行。
 */
export function parsePhraseFile(text: string): Array<{ from: string; to: string }> {
  const lines = text.split(/\r\n|\n|\r/);
  const isTab = lines.some((line) => !line.trimStart().startsWith("#") && line.includes("\t"));
  if (isTab) {
    return parseTabDictionary(text);
  }
  const withoutComments = lines.filter((line) => !line.trimStart().startsWith("#")).join("\n");
  return dedupeKeepLast(parsePhraseCsv(withoutComments));
}

/** 触发浏览器下载一个文本文件。 */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 词典页每批渲染的词组数。 */
export const PHRASE_PAGE_SIZE = 100;

/** 按原词或替换词做不区分大小写的包含匹配；空查询返回全部。 */
export function filterPhrases<T extends { from: string; to: string }>(phrases: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return phrases;
  }
  return phrases.filter((p) => p.from.toLowerCase().includes(q) || p.to.toLowerCase().includes(q));
}
