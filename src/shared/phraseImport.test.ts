import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../core/storage";
import { MAX_IMPORT_FILE_BYTES, MAX_PHRASES_PER_VARIANT } from "./phraseCsv";
import { importPhraseFile } from "./phraseImport";

const settings = mergeSettings(DEFAULT_SETTINGS, { defaultVariant: "zh-TW" });

// jsdom 的 File 没有 text()，这里用最小桩对象代替。
function file(text: string, size = text.length): File {
  return { size, text: async () => text } as unknown as File;
}

afterEach(() => vi.restoreAllMocks());

describe("importPhraseFile", () => {
  it("解析 CSV 并返回补丁，不弹提示", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const patch = await importPhraseFile(file("from,to\n软件,軟體\n"), settings, "zh-TW");
    expect(patch?.userDictionary?.phrases?.["zh-TW"]?.[0]).toMatchObject({ from: "软件", to: "軟體" });
    expect(alert).not.toHaveBeenCalled();
  });

  it("文件过大时提示并返回 null", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    expect(await importPhraseFile(file("x", MAX_IMPORT_FILE_BYTES + 1), settings, "zh-TW")).toBeNull();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("没有可导入的行时提示并返回 null", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    expect(await importPhraseFile(file("# only comments\n"), settings, "zh-TW")).toBeNull();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("超出上限时提示被跳过的数量，其余仍导入", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const rows = Array.from({ length: MAX_PHRASES_PER_VARIANT + 5 }, (_, i) => `a${i}\tb${i}`).join("\n");
    const patch = await importPhraseFile(file(rows), settings, "zh-TW");
    expect(patch?.userDictionary?.phrases?.["zh-TW"]).toHaveLength(MAX_PHRASES_PER_VARIANT);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String(alert.mock.calls[0][0])).toContain("5");
  });
});
