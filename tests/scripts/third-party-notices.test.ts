// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_PACKAGES, buildThirdPartyNotices } from "../../scripts/third-party-notices";

const root = join(__dirname, "../..");

describe("buildThirdPartyNotices", () => {
  const notices = buildThirdPartyNotices(root);

  it("登记了所有生产依赖", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const registered = BUNDLED_PACKAGES.map((item) => item.name);
    for (const name of Object.keys(pkg.dependencies)) {
      expect(registered).toContain(name);
    }
  });

  it("每个包都附有名称、版本与许可证", () => {
    for (const { name } of BUNDLED_PACKAGES) {
      expect(notices).toMatch(new RegExp(`^${name} \\d+\\.\\d+\\.\\d+$`, "m"));
    }
    expect(notices).toContain("License: MIT");
  });

  it("包含 OpenCC 字典数据的 Apache-2.0 全文", () => {
    expect(notices).toContain("opencc-data");
    expect(notices).toContain("Apache License");
    expect(notices).toContain("END OF TERMS AND CONDITIONS");
  });

  it("缺少 LICENSE 文件的 MIT 包按 author 补全版权声明", () => {
    expect(notices).toContain("Copyright (c) Aaron Klinker");
  });
});
