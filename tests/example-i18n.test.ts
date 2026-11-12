import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { languageFromNavigator, messages, resolveLang, translate } from "../examples/web/src/i18n.js";

describe("web example language support", () => {
  it("has the same message keys in English and Korean", () => {
    expect(Object.keys(messages.ko).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it("uses the same placeholders in both languages", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(messages.en) as Array<keyof typeof messages.en>) {
      expect(names(messages.ko[key]), key).toEqual(names(messages.en[key]));
    }
  });

  it("never leaves a message empty", () => {
    for (const lang of ["en", "ko"] as const) {
      for (const [key, value] of Object.entries(messages[lang])) expect(value.trim(), `${lang}.${key}`).not.toBe("");
    }
  });

  it("prefers the stored choice over the browser language", () => {
    expect(resolveLang({ stored: "en", navigatorLanguage: "ko-KR" })).toBe("en");
    expect(resolveLang({ stored: "ko", navigatorLanguage: "en-US" })).toBe("ko");
  });

  it("falls back to the browser language: ko* is Korean, everything else English", () => {
    expect(resolveLang({ stored: null, navigatorLanguage: "ko-KR" })).toBe("ko");
    expect(resolveLang({ stored: null, navigatorLanguage: "ko" })).toBe("ko");
    expect(resolveLang({ stored: null, navigatorLanguage: "fr-FR" })).toBe("en");
    expect(resolveLang({})).toBe("en");
    expect(languageFromNavigator("KO-kr")).toBe("ko");
  });

  it("lets ?lang= pick the language for screenshots and ignores invalid values", () => {
    expect(resolveLang({ search: "?lang=ko", stored: "en", navigatorLanguage: "en-US" })).toBe("ko");
    expect(resolveLang({ search: "?lang=xx", stored: "ko", navigatorLanguage: "en-US" })).toBe("ko");
  });

  it("switching the language changes the rendered text", () => {
    const vars = { page: 1, score: "0.93" };
    expect(translate("en", "foundFuzzy", vars)).toBe("Found on page 1 (approximate match, score 0.93)");
    expect(translate("ko", "foundFuzzy", vars)).toBe("1쪽에서 찾았습니다(근사 일치, 점수 0.93)");
    expect(translate("en", "foundFuzzy", vars)).not.toBe(translate("ko", "foundFuzzy", vars));
  });

  it("has a non-empty answer sentence in both languages", () => {
    const answers = JSON.parse(readFileSync(new URL("../examples/web/answers.json", import.meta.url), "utf8")) as Array<{ id: number; text: { en: string; ko: string } }>;
    for (const a of answers) {
      expect(a.text.en.trim(), `answer ${a.id} en`).not.toBe("");
      expect(a.text.ko.trim(), `answer ${a.id} ko`).not.toBe("");
    }
  });
});
