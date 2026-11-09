import { describe, expect, it } from "vitest";
import { getLegalHtml, getLegalMarkdown } from "./legal";

const ISSUES = "https://github.com/amlzq/chinese-variants-linter/issues";
const EMAIL = "[support@zeaon.dev](mailto:support@zeaon.dev)";
const CONTACT_LINES = {
  CN: `使用遇到问题？请在 [GitHub Issues](${ISSUES}) 上寻求帮助，或发送邮件至 ${EMAIL}。`,
  TW: `使用上遇到問題嗎？請到 [GitHub Issues](${ISSUES}) 尋求協助，或寄送電子郵件至 ${EMAIL}。`,
  HK: `使用上遇到問題？請到 [GitHub Issues](${ISSUES}) 尋求協助，或發送電郵至 ${EMAIL}。`,
  EN: `Having trouble using? Get help on [GitHub issues](${ISSUES}), or email ${EMAIL}.`,
} as const;

describe("getLegalMarkdown", () => {
  it("每个地区只含对应语言版本的正文", () => {
    const expectations = [
      ["CN", "本扩展不收集、不传输、不出售任何用户数据"],
      ["SG", "本扩展不收集、不传输、不出售任何用户数据"],
      ["TW", "本擴充功能不會蒐集、傳送或販售任何使用者資料"],
      ["HK", "本擴充功能不會收集、傳輸或出售任何用戶資料"],
      ["MO", "本擴充功能不會收集、傳輸或出售任何用戶資料"],
      ["EN", "does not collect, transmit, or sell any user data"],
    ] as const;
    const all = expectations.map(([, text]) => text);
    for (const [region, text] of expectations) {
      const md = getLegalMarkdown("privacy", region);
      expect(md, region).toContain(text);
      for (const other of new Set(all)) {
        if (other !== text) expect(md, `${region} should not contain ${other}`).not.toContain(other);
      }
    }
  });

  it("台湾版与香港版使用各自的用语", () => {
    const tw = getLegalMarkdown("terms", "TW");
    const hk = getLegalMarkdown("terms", "HK");
    expect(tw).toContain("取代建議");
    expect(tw).toContain("偵測");
    expect(hk).toContain("替換建議");
    expect(hk).toContain("檢測");
    expect(tw).not.toContain("檢測");
    expect(hk).not.toContain("偵測");
  });

  it("每个语言版本各自带「联系」小节：标题与内容都按语言本地化", () => {
    const headings = { CN: "### 联系\n", TW: "### 聯絡\n", HK: "### 聯絡\n", EN: "### Contact\n" } as const;
    for (const kind of ["privacy", "terms"] as const) {
      for (const region of ["CN", "TW", "HK", "EN"] as const) {
        const md = getLegalMarkdown(kind, region);
        expect(md, `${kind} ${region}`).toContain(headings[region]);
        expect(md.endsWith(CONTACT_LINES[region]), `${kind} ${region}`).toBe(true);
        // 邮箱与 GitHub Issues 链接只在联系小节里出现一次。
        expect(md.split("mailto:support@zeaon.dev").length - 1, `${kind} ${region}`).toBe(1);
      }
    }
  });

  it("中文版联系小节不再是固定的英文", () => {
    for (const kind of ["privacy", "terms"] as const) {
      for (const region of ["CN", "TW", "HK"] as const) {
        expect(getLegalMarkdown(kind, region)).not.toContain("Having trouble using?");
      }
    }
  });

  it("不含文档总标题与语言版本的分节标题", () => {
    for (const kind of ["privacy", "terms"] as const) {
      for (const region of ["CN", "TW", "HK", "EN"] as const) {
        const md = getLegalMarkdown(kind, region);
        expect(md).not.toMatch(/^# /m);
        expect(md).not.toMatch(/^## /m);
      }
    }
  });

  it("政策名称统一为「隐私权政策」，不再出现「隐私政策」", () => {
    for (const region of ["CN", "TW", "HK", "EN"] as const) {
      for (const kind of ["privacy", "terms"] as const) {
        const md = getLegalMarkdown(kind, region);
        expect(md).not.toContain("隐私政策");
        expect(md).not.toContain("隱私政策");
      }
    }
  });

  it("四个语言版本的章节结构一致", () => {
    const shape = (kind: "privacy" | "terms", region: "CN" | "TW" | "HK" | "EN") => {
      const md = getLegalMarkdown(kind, region);
      return {
        h4: (md.match(/^### /gm) ?? []).length,
        bullets: (md.match(/^- /gm) ?? []).length,
        tableRows: (md.match(/^\|/gm) ?? []).length,
      };
    };
    for (const kind of ["privacy", "terms"] as const) {
      const base = shape(kind, "CN");
      for (const region of ["TW", "HK", "EN"] as const) {
        expect(shape(kind, region), `${kind} ${region}`).toEqual(base);
      }
    }
  });

  it("服务条款与隐私权政策的联系信息：GitHub issues 与支持邮箱", () => {
    const html = getLegalHtml("terms", "EN");
    expect(html).toContain('href="mailto:support@zeaon.dev"');
    expect(html).toContain('href="https://github.com/amlzq/chinese-variants-linter/issues"');
  });

  it("隐私权政策权限表格完整", () => {
    for (const region of ["CN", "TW", "HK", "EN"] as const) {
      const html = getLegalHtml("privacy", region);
      expect(html, region).toContain("<table>");
      expect(html, region).toContain("<code>storage</code>");
      expect(html, region).toContain("<code>activeTab</code>");
    }
  });
});
