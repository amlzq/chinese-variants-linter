import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 打进扩展包的第三方代码与数据。新增运行时依赖时需在此登记，
 * 否则 scripts/third-party-notices.test.ts 会失败。
 */
export const BUNDLED_PACKAGES: ReadonlyArray<{
  name: string;
  /** 除 LICENSE 外还需随附的许可文件，如 opencc-js 内置字典数据的 Apache-2.0 许可。 */
  extraFiles?: string[];
}> = [
  { name: "opencc-js", extraFiles: ["THIRD_PARTY_LICENSES.md"] },
  { name: "react" },
  { name: "react-dom" },
  { name: "scheduler" },
  // WXT 的内容脚本运行时与 browser 封装会被打进产物。
  { name: "wxt" },
  { name: "@wxt-dev/browser" },
];

const LICENSE_FILE_NAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE"];

const MIT_TEMPLATE = `MIT License

Copyright (c) {holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

interface PackageJson {
  version: string;
  license?: string;
  author?: string | { name?: string };
  homepage?: string;
  repository?: string | { url?: string };
}

function readPackageJson(packageDir: string): PackageJson {
  return JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as PackageJson;
}

function getRepositoryUrl(pkg: PackageJson): string {
  const raw = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  return (raw ?? pkg.homepage ?? "").replace(/^git\+/, "").replace(/\.git$/, "");
}

function getAuthorName(pkg: PackageJson): string | undefined {
  return typeof pkg.author === "string" ? pkg.author.replace(/\s*<.*$/, "") : pkg.author?.name;
}

/**
 * 读取包自带的许可文件。部分 MIT 包（如 wxt）的 npm 发布物不含 LICENSE，
 * 此时用标准 MIT 文本并以 package.json 的 author 作为版权人；其他许可缺少文件时直接报错，
 * 避免产出不完整的声明。
 */
function readLicenseText(name: string, packageDir: string, pkg: PackageJson): string {
  for (const fileName of LICENSE_FILE_NAMES) {
    const file = join(packageDir, fileName);
    if (existsSync(file)) {
      return readFileSync(file, "utf8").trim();
    }
  }

  const author = getAuthorName(pkg);
  if (pkg.license === "MIT" && author) {
    return MIT_TEMPLATE.replace("{holder}", author);
  }

  throw new Error(`第三方许可声明：${name} 缺少许可文件，且无法按 MIT 补全（license: ${pkg.license}）`);
}

export function buildThirdPartyNotices(root: string): string {
  const sections = BUNDLED_PACKAGES.map(({ name, extraFiles = [] }) => {
    const packageDir = join(root, "node_modules", name);
    const pkg = readPackageJson(packageDir);
    const parts = [
      `${name} ${pkg.version}`,
      `License: ${pkg.license ?? "UNKNOWN"}`,
      `Source: ${getRepositoryUrl(pkg)}`,
      "",
      readLicenseText(name, packageDir, pkg),
      ...extraFiles.map((file) => readFileSync(join(packageDir, file), "utf8").trim()),
    ];
    return parts.join("\n");
  });

  const divider = `\n\n${"=".repeat(80)}\n\n`;
  return [
    "Third-party notices for Chinese Variants Linter",
    "",
    "This extension bundles the following third-party software and data.",
    "Each component is distributed under the license reproduced below.",
  ].join("\n") + divider + sections.join(divider) + "\n";
}
