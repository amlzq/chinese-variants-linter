import { describe, expect, it } from "vitest";
import {
  buildPhraseTemplateCsv,
  parsePhraseCsv,
  parsePhraseFile,
  parseTabDictionary,
  serializePhraseCsv,
} from "./phraseCsv";

describe("parsePhraseCsv", () => {
  it("解析两列并跳过表头、空行、缺列行", () => {
    const text = "from,to\r\n软件,軟體\n\n视频,影片\nonlyfrom,\n,onlyto\n";
    expect(parsePhraseCsv(text)).toEqual([
      { from: "软件", to: "軟體" },
      { from: "视频", to: "影片" },
    ]);
  });

  it("没有表头也能解析，并去除 BOM 与首尾空白", () => {
    expect(parsePhraseCsv("﻿ 软件 , 軟體 ")).toEqual([{ from: "软件", to: "軟體" }]);
  });

  it("支持引号、转义引号与字段内逗号 / 换行", () => {
    expect(parsePhraseCsv('"a,b","say ""hi"""\n"x\ny",z')).toEqual([
      { from: "a,b", to: 'say "hi"' },
      { from: "x\ny", to: "z" },
    ]);
  });

  it("空内容返回空数组", () => {
    expect(parsePhraseCsv("")).toEqual([]);
  });
});

describe("serializePhraseCsv", () => {
  it("带 BOM 与表头，必要时加引号，并可被 parse 还原", () => {
    const rows = [
      { from: "a,b", to: 'say "hi"' },
      { from: "软件", to: "軟體" },
    ];
    const csv = serializePhraseCsv(rows);
    expect(csv.startsWith("﻿from,to\r\n")).toBe(true);
    expect(parsePhraseCsv(csv)).toEqual(rows);
  });
});

describe("buildPhraseTemplateCsv", () => {
  it("模板包含表头与示例行", () => {
    const rows = parsePhraseCsv(buildPhraseTemplateCsv());
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("parseTabDictionary / parsePhraseFile (OpenCC 词条格式)", () => {
  const text = [
    "# Custom phrase dictionary",
    "#程序\t程式",
    "",
    "程序\t程式",
    "软件\t軟體 软件体",
    "内存\t記憶體",
    "没有制表符的行",
    "软件\t軟件",
  ].join("\n");

  it("跳过注释、空行与无制表符行，多候选取第一个，重复原词以最后一条为准", () => {
    expect(parseTabDictionary(text)).toEqual([
      { from: "程序", to: "程式" },
      { from: "软件", to: "軟件" },
      { from: "内存", to: "記憶體" },
    ]);
  });

  it("只有注释的示例文件解析为空", () => {
    expect(parsePhraseFile("# a\n#程序\t程式\n#软件\t軟體\n")).toEqual([]);
  });

  it("parsePhraseFile 自动识别 OpenCC 词条格式与 CSV", () => {
    expect(parsePhraseFile(text)).toEqual(parseTabDictionary(text));
    expect(parsePhraseFile("# note\nfrom,to\n软件,軟體\n")).toEqual([{ from: "软件", to: "軟體" }]);
  });
});
