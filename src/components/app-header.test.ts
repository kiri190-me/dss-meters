/**
 * ============================================================================
 * 머리말 오른쪽 묶음이 폰에서 무너지지 않는다
 * ============================================================================
 * 🔴 2026-09-18 사용자 폰 사진(360px · 한국어 · 관리자): 오른쪽 글자 다섯이
 * 한 줄에 못 들어가자 flex 가 칸을 min-content 까지 눌러 **버튼 안에서 글자를
 * 세로로 접었다** — "한국 / 어", "통합 로그인으 / 로", "로그아 / 웃".
 *
 * 고친 방법은 둘이고 **짝으로만** 참이다:
 *   1. 칸마다 `whitespace-nowrap` — 글자는 접히지 않는다.
 *   2. 묶음에 `flex-wrap` — 대신 넘치면 줄을 바꾼다.
 *      (2 없이 1만 걸면 페이지가 통째로 가로로 밀린다.)
 * 그리고 폰에서만 짧은 이름을 보여 애초에 한 줄에 들어가게 했다.
 *
 * 🔴 줄이는 것은 **눈에서만**이다: 긴 이름은 sr-only 로 마크업에 남고, 768px
 * 부터 눈에도 되돌아온다 — 넓은 화면의 생김새는 이 변경 전과 똑같아야 한다.
 * ============================================================================
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { LANGUAGE_LABEL, LANGUAGE_SHORT, LANGUAGES } from "@/lib/i18n";
import { ko } from "@/lib/i18n/ko";
import { ja } from "@/lib/i18n/ja";

const repoFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const withoutComments = (source: string) =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const appHeader = withoutComments(repoFile("src/components/AppHeader.tsx"));
const languageSwitch = withoutComments(repoFile("src/components/LanguageSwitch.tsx"));
const filterBar = withoutComments(repoFile("src/components/FilterBar.tsx"));

/**
 * 글자 폭 어림(px). 한글·가나·한자는 한 글자가 글자크기 한 칸, 로마자·숫자는
 * 0.55칸, 빈칸은 0.28칸. Malgun Gothic 실측과 ±5% 안에서 맞는다.
 */
function textWidth(text: string, fontSize: number): number {
  const cells = [...text].reduce((sum, ch) => {
    if (ch === " ") return sum + 0.28;
    return sum + (/[\x20-\x7E]/.test(ch) ? 0.55 : 1);
  }, 0);
  return cells * fontSize;
}

// ── 1. 글자가 접히지 않는다 ─────────────────────────────────────────────────

test("🔴 오른쪽 묶음의 글자 칸마다 whitespace-nowrap 이 걸려 있다", () => {
  // 하나라도 빠지면 그 칸만 폰에서 다시 세로로 접힌다.
  const shouldNotWrap = [
    [/href="\/settings\/notify"[\s\S]*?className="([^"]*)"/, "알림 설정"],
    [/href=\{portalUrl\}[\s\S]*?className="([^"]*)"/, "포털"],
    [/action=\{logoutAction\}[\s\S]*?className="([^"]*)"/, "로그아웃"],
    [/className="(hidden items-center[^"]*)"/, "사용자명·역할"],
  ] as const;

  for (const [pattern, label] of shouldNotWrap) {
    const found = appHeader.match(pattern);
    assert.ok(found, `${label} 칸을 찾지 못했다`);
    assert.ok(
      found[1].split(/\s+/).includes("whitespace-nowrap"),
      `${label} 이 폰에서 글자가 접힌다 — whitespace-nowrap 이 없다`
    );
  }

  // 언어 전환은 눌린 칸·안 눌린 칸 두 벌이라 둘 다 본다.
  const langClasses = [...languageSwitch.matchAll(/"(rounded-md[^"]*)"/g)].map((m) => m[1]);
  assert.equal(langClasses.length, 2, "언어 버튼의 생김새가 두 벌이 아니다");
  for (const classes of langClasses) {
    assert.ok(
      classes.split(/\s+/).includes("whitespace-nowrap"),
      "언어 버튼이 폰에서 '한국 / 어' 로 접힌다"
    );
  }
});

test("🔴 nowrap 은 flex-wrap 과 짝이다 — 없으면 페이지가 가로로 밀린다", () => {
  // 글자를 접지 못하게 막아 놓고 줄도 못 바꾸게 하면, 넘치는 만큼 화면 밖으로
  // 나가 페이지 전체에 가로 스크롤이 생긴다.
  const right = appHeader.match(/className="(ml-auto[^"]*)"/);
  assert.ok(right, "오른쪽 묶음을 찾지 못했다");
  const classes = right[1].split(/\s+/);
  assert.ok(classes.includes("flex-wrap"), "오른쪽 묶음이 줄을 바꾸지 못한다");
  assert.ok(classes.includes("justify-end"), "줄이 바뀌면 둘째 줄이 왼쪽으로 흩어진다");

  // 바깥 줄(머리말 전체)도 그대로 줄을 바꿀 수 있어야 한다.
  assert.match(appHeader, /className="mx-auto flex max-w-\[1400px\] flex-wrap/);
});

test("🔴 거르개 라벨도 접히지 않는다 — 사진에서 '상 / 태' 로 끊겼다", () => {
  const labels = [...filterBar.matchAll(/className="(flex items-center gap-1\.5[^"]*)"/g)];
  assert.equal(labels.length, 2, "거르개 라벨이 둘이 아니다(자산·상태)");
  for (const [, classes] of labels) {
    assert.ok(
      classes.split(/\s+/).includes("whitespace-nowrap"),
      "거르개 라벨이 한 글자씩 세로로 끊긴다"
    );
  }
});

// ── 2. 줄이는 것은 눈에서만, 좁은 화면에서만 ────────────────────────────────

test("🔴 넓은 화면(≥768px)의 글자는 이 변경 전과 똑같다", () => {
  // 짧은 이름은 md 부터 사라지고, 긴 이름은 md 부터 평범한 글자로 돌아온다.
  // 기준점이 하나(md = 768px)라 그 사이 폭에서 둘 다 보이거나 둘 다 없는
  // 어정쩡한 상태가 생기지 않는다.
  const shortSpans = [...appHeader.matchAll(/<span className="([^"]*)" aria-hidden="true">/g)];
  assert.ok(shortSpans.length >= 2, "짧은 이름 칸을 찾지 못했다(알림·포털)");
  for (const [, classes] of shortSpans) {
    assert.ok(classes.split(/\s+/).includes("md:hidden"), "짧은 이름이 넓은 화면에도 남는다");
  }

  const longSpans = [
    ...appHeader.matchAll(/<span className="sr-only md:not-sr-only">\{(t\.nav\.[\w]+)\}<\/span>/g),
  ].map((m) => m[1]);
  assert.deepEqual(
    longSpans.sort(),
    ["t.nav.notifySettings", "t.nav.portal"],
    "긴 이름이 md 에서 되돌아오지 않는다"
  );

  // 언어 전환도 같은 방식·같은 기준점이다.
  assert.match(languageSwitch, /className="md:hidden" aria-hidden="true"/);
  assert.match(languageSwitch, /className="sr-only md:not-sr-only">\{LANGUAGE_LABEL\[lang\]\}/);
});

test("🔴 긴 이름을 지운 것이 아니다 — 낭독기는 그대로 읽는다", () => {
  // `hidden`(display:none)으로 지웠다면 폰에서 그 링크의 이름이 "포털" 두
  // 글자뿐이거나(줄임말), 아예 없어진다. sr-only 는 마크업에 남는다.
  for (const source of [appHeader, languageSwitch]) {
    for (const match of source.matchAll(/className="(sr-only[^"]*)"/g)) {
      assert.equal(
        match[1].split(/\s+/).includes("hidden"),
        false,
        "긴 이름을 display:none 으로 지웠다 — 낭독기에서도 사라진다"
      );
    }
  }
  assert.match(appHeader, /\{t\.nav\.portal\}/);
  assert.match(appHeader, /\{t\.nav\.notifySettings\}/);
  assert.match(languageSwitch, /\{LANGUAGE_LABEL\[lang\]\}/);
});

test("🔴 나가는 길 둘은 그대로 남아 있고, 눌러서 갈 수 있다", () => {
  // 짧게 줄인 것이지 없앤 것이 아니다.
  assert.match(appHeader, /href=\{portalUrl\}/, "포털로 가는 링크가 사라졌다");
  assert.match(appHeader, /<form action=\{logoutAction\}>/, "로그아웃 form 이 사라졌다");
  assert.match(appHeader, /type="submit"/, "로그아웃 버튼이 사라졌다");
  // 로그아웃은 두 언어 모두 온전한 말로 남긴다(짧은 이름을 두지 않았다).
  assert.equal(appHeader.includes("logoutShort"), false);
});

// ── 3. 폰 폭 셈 ─────────────────────────────────────────────────────────────

test("🔴 폰(360px)에서 오른쪽 묶음이 한 줄에 들어간다", () => {
  const INNER = 360 - 16 * 2; // px-4 좌우
  const GAP = 12; // gap-3
  const PX_2_5 = 10 * 2; // 버튼 좌우 여백
  const BORDER = 2; // 포털만 테두리가 있다

  for (const [lang, dict] of [
    ["ko", ko],
    ["ja", ja],
  ] as const) {
    // 폰에서는 짧은 이름이 보인다. 사용자명 묶음은 640px 밑이라 감춰져 0 이다.
    const notify = textWidth(dict.nav.notifySettingsShort, 14); // 관리자만
    const langSwitch =
      LANGUAGES.reduce((sum, l) => sum + textWidth(LANGUAGE_SHORT[l], 12) + PX_2_5, 0) + 4;
    const portal = textWidth(dict.nav.portalShort, 12) + PX_2_5 + BORDER;
    const logout = textWidth(dict.nav.logout, 12) + PX_2_5;

    const admin = notify + GAP + langSwitch + GAP + portal + GAP + logout;
    assert.ok(
      admin <= INNER,
      `${lang}: 관리자 머리말 오른쪽이 ${Math.round(admin)}px 이라 ${INNER}px 을 넘는다 — 또 줄이 바뀐다`
    );
  }
});

test("🔴 짧은 이름이 두 언어 모두에 있다", () => {
  for (const dict of [ko, ja]) {
    for (const key of ["notifySettingsShort", "portalShort"] as const) {
      assert.ok(dict.nav[key].trim().length > 0, `${key} 가 비어 있다`);
      assert.ok(
        dict.nav[key].length < dict.nav[key === "portalShort" ? "portal" : "notifySettings"].length,
        `${key} 가 긴 이름보다 짧지 않다 — 줄이는 뜻이 없다`
      );
    }
  }
});

test("🔴 언어 줄임말은 제 언어를 쓰는 사람이 제 칸을 알아본다", () => {
  // "한"·"日" 은 각각 "한국어"·"日本語" 의 첫 글자다. 상대 언어를 읽을 줄
  // 몰라도 제 칸을 찾을 수 있어야 해서 "KO/JA" 같은 로마자를 쓰지 않는다.
  for (const lang of LANGUAGES) {
    assert.equal(LANGUAGE_SHORT[lang].length, 1, `${lang} 줄임말이 한 글자가 아니다`);
    assert.equal(
      LANGUAGE_SHORT[lang],
      LANGUAGE_LABEL[lang][0],
      `${lang} 줄임말이 제 언어 이름의 첫 글자가 아니다 — 알아보지 못한다`
    );
    assert.equal(
      /[\x20-\x7E]/.test(LANGUAGE_SHORT[lang]),
      false,
      `${lang} 줄임말이 로마자다`
    );
  }
});
