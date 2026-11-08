import { describe, expect, it } from "vitest";
import { buildPhraseTemplateCsv, parsePhraseCsv, serializePhraseCsv } from "./phraseCsv";

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
