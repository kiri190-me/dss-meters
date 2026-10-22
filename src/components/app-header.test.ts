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
import { readdirSync, readFileSync } from "node:fs";
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
  //
  // 🔴 2026-10-22 에 **줄을 바꾸는 자리가 한 겹 안쪽으로 들어갔다.** 글자 칸
  //    다섯이 768px 미만에서는 ☰ 서랍으로 가고, 넓은 화면에서는 그 다섯만 모은
  //    안쪽 묶음에서 줄을 바꾼다. 바깥 줄(머리말 전체)의 flex-wrap 은 그대로다.
  const inner = appHeader.match(/className="(hidden flex-wrap[^"]*)"/);
  assert.ok(inner, "글자 다섯을 모은 안쪽 묶음을 찾지 못했다");
  const innerClasses = inner[1].split(/\s+/);
  assert.ok(innerClasses.includes("flex-wrap"), "글자 묶음이 줄을 바꾸지 못한다");
  assert.ok(innerClasses.includes("md:flex"), "글자 묶음이 넓은 화면에서도 안 보인다");

  // 바깥 줄(머리말 전체)도 그대로 줄을 바꿀 수 있어야 한다.
  assert.match(appHeader, /className="mx-auto flex max-w-\[1400px\] flex-wrap/);
});

test("🔴 ④ 오른쪽 묶음은 **제 내용 폭**만 쓴다 — 줄을 통째로 먹지 않는다", () => {
  // 🔴 2026-10-22. 그 전에는 폰에서 `w-full` 로 줄을 통째로 쓰고 왼쪽 끝에서
  //    시작했다(글자 칸 다섯이 거기 늘어서던 때의 장치다). 다섯이 ☰ 서랍으로
  //    들어간 뒤로 그대로 두면 **알림 종 하나가 제 줄을 차지해** 폰 머리말이
  //    여전히 두 줄이다. 제 내용 폭이라야 ☰·이름·단추·종이 한 줄에 선다.
  const right = appHeader.match(/className="(ml-auto[^"]*)"/);
  assert.ok(right, "오른쪽 묶음을 찾지 못했다");
  const classes = right[1].split(/\s+/);

  assert.ok(classes.includes("ml-auto"), "묶음이 오른쪽 끝으로 가지 않는다");
  assert.equal(classes.includes("w-full"), false, "묶음이 줄을 통째로 먹는다 — 종이 제 줄로 밀려난다");
  assert.equal(classes.includes("sm:w-auto"), false, "폰에서만 줄을 먹던 때의 짝이 남아 있다");
  assert.equal(classes.includes("sm:justify-end"), false, "줄을 먹던 때의 정렬이 남아 있다");
});

test("🔴 거르개 라벨도 접히지 않는다 — 사진에서 '상 / 태' 로 끊겼다", () => {
  const labels = [...filterBar.matchAll(/<label className="([^"]*)">/g)];
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

test("🔴 ☰ 서랍 안에 가장 긴 글자가 들어간다 — 두 언어 모두", () => {
  // 🔴 2026-10-22 에 재는 대상이 바뀌었다. 그 전에는 「폰에서 오른쪽 묶음이 한 줄에
  //    들어가는가」를 쟀는데, 그 묶음이 768px 미만에서는 통째로 ☰ 서랍으로 들어가
  //    폰에 늘어서는 일 자체가 없어졌다. 이제 넘칠 수 있는 곳은 **서랍 폭**이다.
  // 🔵 서랍은 자리가 넉넉해 **긴 이름**을 쓴다 — 줄인 이름은 여기 쓰지 않는다.
  const PANEL = 256 - 16 * 2; // w-64 에서 px-4 좌우를 뺀 속폭 224
  const PX_2_5 = 10 * 2; // 버튼 좌우 여백
  const PX_2 = 8 * 2; // 서랍 링크의 좌우 여백
  const BORDER = 2; // 포털만 테두리가 있다

  for (const [lang, dict] of [
    ["ko", ko],
    ["ja", ja],
  ] as const) {
    const langSwitch =
      LANGUAGES.reduce((sum, l) => sum + textWidth(LANGUAGE_SHORT[l], 12) + PX_2_5, 0) + 4;

    const rows = [
      [textWidth(dict.nav.notifySettings, 14) + PX_2, "알림 설정"],
      [langSwitch, "언어 전환"],
      [textWidth(dict.nav.portal, 12) + PX_2_5 + BORDER, "통합 로그인으로"],
      [textWidth(dict.nav.logout, 12) + PX_2_5, "로그아웃"],
    ] as const;

    for (const [width, label] of rows) {
      assert.ok(
        width <= PANEL,
        `${lang}: 서랍의 「${label}」 이 ${Math.round(width)}px 이라 속폭 ${PANEL}px 을 넘는다`
      );
    }
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

// ── 4. 시스템 이름은 폰에서도 보인다 (2026-09-18 오후 되돌림) ───────────────

test("🔴 시스템 이름은 폰에서도 눈에 보인다 — 감추던 것을 되돌렸다", () => {
  // 🔴 오전에 잠깐 `sr-only md:not-sr-only` 로 감춰 두었다. 메뉴바가 아직
  // **가로로 늘어선 칸 셋**(123px)이던 때 그 셋이 다 보이게 하려던 것이었다.
  // 메뉴바가 드롭다운 **단추 하나**(폰 59px)가 되면서 이유가 사라졌고,
  // 이 저장소는 목록 화면의 본문 제목이 print-only 라 감추면 폰 첫 화면에
  // 시스템 이름이 글자로 한 톨도 남지 않았다.
  const brand = appHeader.match(/<Link href="\/" className="([^"]*)">/);
  assert.ok(brand, "시스템 이름을 그리는 홈 링크를 찾지 못했다");
  const classes = brand[1].split(/\s+/);

  assert.equal(classes.includes("sr-only"), false, "폰에서 이름이 다시 감춰졌다");
  assert.equal(classes.includes("hidden"), false, "이름을 display:none 으로 지웠다");
  assert.equal(
    classes.includes("md:not-sr-only"),
    false,
    "감추지 않는데 되돌리는 유틸리티만 남았다 — 읽는 사람이 헷갈린다"
  );

  // 글자와 링크는 그대로다.
  assert.match(appHeader, /\{t\.app\.title\}/, "이름 글자를 통째로 뺐다");
  assert.match(appHeader, /\{t\.app\.company\}/);
  assert.match(appHeader, /href="\/"/, "홈으로 가는 길이 사라졌다");
});

test("🔴 짧은 이름을 되돌리는 기준점이 메뉴바 단추의 「아이콘만」 기준점과 같다", () => {
  // 알림·포털·언어전환이 긴 이름으로 돌아오는 `md:` 와, 메뉴 **단추**가
  // 이름을 되찾는 기준점이 같아야 한다. 어긋나면 그 사이 폭에서 「오른쪽은
  // 긴 이름인데 단추는 이모지 하나」인 어정쩡한 상태가 생긴다.
  const menuCss = repoFile("vendor/dss-ui/src/service-menu/service-menu.css");
  const breakpoint = menuCss.match(/@media not all and \(min-width: (\d+)px\)/);
  assert.ok(breakpoint, "메뉴바의 기준점을 찾지 못했다");
  assert.equal(breakpoint[1], "768", "메뉴바 기준점이 768px 이 아니다");

  // 이 저장소가 Tailwind 의 md 기준점을 딴 값으로 덮지 않았는지.
  const globals = repoFile("src/app/globals.css");
  assert.equal(/--breakpoint-md:\s*(?!768px)/.test(globals), false);
});

test("🔴 폰(360px)에서 머리말이 **한 줄**이다 — ☰·이름·단추·종", () => {
  // 메뉴 칸은 `shrink-0` 이라 줄 나누기에 제 내용 폭(폰 59px)으로 참여한다.
  assert.match(
    appHeader,
    /<div className="shrink-0">\{serviceMenu\}<\/div>/,
    "메뉴 칸이 shrink-0 이 아니다 — 단추가 줄어들지 못해 글자와 겹친다"
  );
  // ☰ 도 같은 까닭으로 안 줄어든다 — 깎이면 손가락에 안 잡힌다.
  assert.match(appHeader, /<details className="[^"]*shrink-0[^"]*md:hidden"/);

  const INNER = 360 - 16 * 2; // 328
  const GAP = 16; // gap-x-4
  const HAMBURGER = 36; // ☰ 는 36px 정사각(손가락 크기)
  const BRAND = 120; // "계측기 관리"(18px) + gap-2 + "DSS"(12px) — ja 는 116
  const BUTTON = 24 + 19 + 6 + 8 + 2; // 폰 드롭다운 단추 59px
  const BELL = 40; // 손가락 화면의 알림 종
  const DRAWER_GROUP = 246; // 서랍으로 들어간 글자 묶음(관리자·짧은 이름 기준)

  // 🔴 넷이 한 줄에 선다. 2026-10-22 전에는 **두 줄**이었다 — 첫 줄 이름+단추,
  //    둘째 줄에 글자 묶음과 종이 섰다. 그 묶음이 ☰ 로 들어가면서 한 줄이 됐다.
  const row = HAMBURGER + GAP + BRAND + GAP + BUTTON + GAP + BELL;
  assert.ok(
    row <= INNER,
    `폰 머리말이 ${row}px 이라 ${INNER}px 을 넘는다 — 또 두 줄이 된다`
  );
  // 🔵 글자 묶음을 도로 꺼내면 그때는 넘친다 — 서랍이 필요한 까닭이 이 한 줄이다.
  assert.ok(
    row + GAP + DRAWER_GROUP > INNER,
    "글자 묶음까지 한 줄에 든다 — 셈을 다시 하고 이 시험의 설명을 고쳐라"
  );
});

// ── 5. 머리말이 굴러도 화면 위에 남는다 (2026-10-22) ────────────────────────
//
// 옆 시스템(재고관리)이 2026-10-22 에 끝낸 「머리말을 휴대폰에서 쓸 수 있게」의
// 셋째 항목이다. 이 저장소는 나머지 둘(글자가 세로로 쪼개지는 것 · 좁은 화면의
// 메뉴 접기)이 이미 끝나 있어서 — 위 ①〜④ 가 그것을 지킨다 — 모자란 이것만
// 더했다. 아래 시험들은 **그 하나가 조용히 풀리는 길**을 전부 막는다.

/** `<header>` 에 걸린 클래스. 주석은 이미 떼어 둔 글자에서 읽는다(파일 머리). */
function headerClasses(): string[] {
  const found = appHeader.match(/<header className="([^"]*)">/);
  assert.ok(found, "머리말 <header> 를 찾지 못했다");
  return found[1].split(/\s+/);
}

/** src 아래의 파일을 확장자로 고른다. 경로는 저장소 뿌리에서 본 상대경로다. */
function sourceFilesUnderSrc(extension: string): string[] {
  return (readdirSync(join(process.cwd(), "src"), { recursive: true }) as string[])
    .map((entry) => `src/${entry.replace(/\\/g, "/")}`)
    .filter((path) => path.endsWith(extension));
}

test("🔴 ⑤ 머리말이 굴러도 화면 맨 위에 남는다", () => {
  const classes = headerClasses();
  assert.ok(classes.includes("sticky"), "머리말이 본문과 함께 굴러 올라간다");
  assert.ok(
    classes.includes("top-0"),
    "붙을 자리가 없다 — sticky 는 top 이 없으면 아무 일도 하지 않는다"
  );

  // 🔴 position 유틸리티는 한 요소에 **하나**뿐이다. 둘을 함께 적으면 Tailwind 가
  //    CSS 를 찍는 차례에 따라 한쪽이 **조용히** 이기고, 지는 날 고정이 풀린다.
  for (const rival of ["relative", "absolute", "fixed", "static"]) {
    assert.equal(
      classes.includes(rival),
      false,
      `position 유틸리티가 둘이다 — sticky 와 ${rival} 이 다툰다`
    );
  }
});

test("🔴 ⑤ 머리말의 z 는 재 본 값이다 — 본문 최대보다 위에 있다", () => {
  // 🔴 여는 대괄호를 따로 이어 붙이는 까닭: 대괄호가 든 클래스처럼 보이는 글자를
  //    소스에 그대로 적으면 Tailwind 가 그것을 클래스 후보로 긁어 간다.
  const OPEN_BRACKET = "\\[";
  const zUtility = new RegExp(`\\bz-${OPEN_BRACKET}?(\\d+)`, "g");

  const headerZ = headerClasses()
    .map((one) => /^z-(\d+)$/.exec(one))
    .find((found) => found !== null);
  assert.ok(headerZ, "머리말에 z 가 없다 — 쌓임 맥락이 없어 본문이 덮을 수 있다");
  const headerLevel = Number(headerZ[1]);

  const screens = sourceFilesUnderSrc(".tsx").concat(sourceFilesUnderSrc(".css"));
  // 🔵 셈이 0 이면 이 시험은 영영 통과한다 — 모으는 쪽부터 확인한다.
  assert.ok(screens.length > 10, `화면 파일을 ${screens.length}개밖에 못 모았다`);

  let bodyMax = 0;
  let bodyMaxWhere = "(본문에 z 가 한 곳도 없다)";
  for (const file of screens) {
    if (file === "src/components/AppHeader.tsx") continue; // 재는 대상이 아니다
    const text = withoutComments(repoFile(file));
    const levels = [
      ...[...text.matchAll(zUtility)].map((m) => Number(m[1])),
      ...[...text.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1])),
    ];
    for (const level of levels) {
      if (level > bodyMax) {
        bodyMax = level;
        bodyMaxWhere = file;
      }
    }
  }

  assert.ok(
    headerLevel > bodyMax,
    `머리말이 ${headerLevel} 인데 본문에 ${bodyMax} 가 있다(${bodyMaxWhere}) — ` +
      "머리말이 덮이는데 오류는 한 줄도 안 난다. 본문을 올렸으면 머리말도 함께 올려라"
  );
});

test("🔴 ⑤ sticky 를 붙여도 펼친 목록 둘은 제자리다 — 제 상자에 매달려 있다", () => {
  // 🔴 머리말에 position 이 생기면 그 안의 `position: absolute` 가 **머리말을
  //    기준으로** 다시 자리를 잡는다. 종과 시스템 메뉴의 펼친 목록이 그러면
  //    엉뚱한 곳에 서는데, 오류는 안 나고 눈으로만 드러난다.
  //    둘 다 **제 상자**가 스스로 relative 라 그런 일이 없다 — 그 전제를 여기서
  //    못 박는다. vendor/dss-ui 는 아홉 사이트가 함께 쓰는 서브모듈이라 이쪽에서
  //    고칠 수 없고, 바뀌는 날 이 시험이 먼저 빨개져야 한다.
  const anchors = [
    ["vendor/dss-ui/src/notification-bell/notification-bell.css", ".dss-bell", "알림 종"],
    [
      "vendor/dss-ui/src/service-menu/service-menu.css",
      ".dss-menu--inline .dss-menu__dropdown",
      "시스템 메뉴",
    ],
  ] as const;

  for (const [file, selector, label] of anchors) {
    // 🔴 **주석을 먼저 뗀다.** 이 CSS 의 머리말에 쓰는 법을 보이는 줄이 있어
    //    (`.dss-bell { … }` 한 줄짜리 예시) 그냥 찾으면 그 예시가 먼저 걸리고,
    //    거기엔 position 이 없어 멀쩡한 CSS 를 두고 빨개진다. 2026-10-22 에
    //    실제로 그렇게 한 번 틀렸다.
    const css = withoutComments(repoFile(file));
    const opensAt = css.indexOf(`${selector} {`);
    assert.ok(opensAt >= 0, `${label} 의 상자(${selector})를 찾지 못했다`);
    const body = css.slice(opensAt, css.indexOf("}", opensAt));
    assert.match(
      body,
      /position:\s*relative/,
      `${label} 의 펼친 목록이 제 상자가 아니라 머리말에 매달린다 — 자리가 어긋난다`
    );
  }

  // 머리말 **안**의 z 는 머리말이 만든 쌓임 맥락 안에서만 겨룬다. 둘 다 50 이고,
  // 바깥(본문)과는 머리말의 z 하나로만 겨룬다 — 위 시험이 그쪽을 본다.
  for (const [file, , label] of anchors) {
    assert.match(
      withoutComments(repoFile(file)),
      /z-index:\s*50/,
      `${label} 의 펼친 목록에 z 가 없다`
    );
  }
});

test("🔴 ⑤ 인쇄에서는 머리말이 통째로 사라진다 — 그래서 고정을 풀 것이 없다", () => {
  // 🔵 본보기(재고관리)는 머리말에 `print:static` 을 달았다. 거기 머리말은 종이에도
  //    찍혀서 고정을 풀어 줘야 하기 때문이다. 이 사이트는 다르다 — 머리말이
  //    `no-print` 라 인쇄에서 display:none 이 된다. 없는 것에 position 을 되돌려
  //    줄 일은 없다. **본보기와 다른 것이 일부러임을 여기서 못 박는다.**
  assert.ok(
    headerClasses().includes("no-print"),
    "머리말이 인쇄에 딸려 나온다 — 그러면 고정을 푸는 장치가 따로 있어야 한다"
  );
  const globals = repoFile("src/app/globals.css");
  assert.match(
    globals,
    /@media print[\s\S]*\.no-print\s*\{\s*display:\s*none\s*!important/,
    "no-print 가 인쇄에서 감추지 않는다 — 머리말이 쪽마다 겹쳐 찍힌다"
  );
});

test("🔴 ⑤ 바깥 줄에 sticky 를 막는 overflow 가 없다", () => {
  // 🔴 조상 중 하나라도 overflow 가 visible 이 아니면 sticky 는 **조용히** 안 먹는다
  //    (오류도 경고도 없다). 이 머리말의 바깥 줄은 셋뿐이다.
  const root = withoutComments(repoFile("src/app/layout.tsx"));
  const internal = withoutComments(repoFile("src/app/(internal)/layout.tsx"));

  const html = root.match(/<html[^>]*className="([^"]*)"/);
  const body = root.match(/<body className="([^"]*)"/);
  const shell = internal.match(/<div className="([^"]*)">/);
  assert.ok(html && body && shell, "바깥 줄 셋 중 하나를 찾지 못했다");

  for (const [classes, label] of [
    [html[1], "<html>"],
    [body[1], "<body>"],
    [shell[1], "사내 구간 바깥 상자"],
  ] as const) {
    assert.equal(
      /\boverflow/.test(classes),
      false,
      `${label} 에 overflow 가 생겼다 — 머리말이 굴러 올라가는데 오류는 안 난다`
    );
  }
  // globals.css 쪽에서 html·body 에 거는 길도 막는다.
  assert.equal(
    /\b(html|body)\b[^{}]*\{[^}]*overflow/.test(repoFile("src/app/globals.css")),
    false,
    "globals.css 가 html·body 에 overflow 를 건다 — 머리말의 sticky 가 죽는다"
  );
  // 굴릴 것이 생기려면 바깥 상자가 화면 높이를 쥐고 있어야 한다.
  assert.match(shell[1], /min-h-full/, "사내 구간 바깥 상자가 화면 높이를 쥐지 않는다");
});

// ── 6. 시스템 이름도 한 글자씩 쪼개지지 않는다 (2026-10-22) ─────────────────

test("🔴 ⑥ 시스템 이름에 울타리가 있다 — 「계 / 측 / 기」로 쪼개지던 칸이다", () => {
  // 🔴 2026-09-18 에 오른쪽 묶음의 글자 칸에는 전부 nowrap 을 걸었는데(위 ①)
  //    **시스템 이름만 빠져 있었다.** 없으면 이 칸의 min-content 가 한글 한 자
  //    폭이 되어, 자리가 모자랄 때 flex 가 거기까지 눌러 글자를 세로로 세운다.
  //    옆 시스템(재고관리)에서 「재 / 고 / 관 / 리」로 실제로 일어난 그 증상이고,
  //    거기서 고친 자리도 이 칸이었다.
  const brand = appHeader.match(/<Link href="\/" className="([^"]*)">/);
  assert.ok(brand, "시스템 이름을 그리는 홈 링크를 찾지 못했다");
  assert.ok(
    brand[1].split(/\s+/).includes("whitespace-nowrap"),
    "시스템 이름이 한 글자씩 세로로 쪼개질 수 있다"
  );

  // 🔵 울타리를 걸어도 **지금 보이는 모습은 한 픽셀도 안 바뀐다.** 첫 줄에 서는
  //    것은 이름과 메뉴 단추뿐이고 둘은 폰 속폭 안에 든다(위 ④ 의 셈과 같은 값).
  const INNER = 360 - 16 * 2; // 328
  const BRAND = 120;
  const BUTTON = 24 + 19 + 6 + 8 + 2; // 59
  assert.ok(
    BRAND + 16 + BUTTON <= INNER,
    "이름과 단추가 첫 줄에 못 든다 — 울타리가 눈에 보이는 변화를 만든다. 셈을 다시 하라"
  );
});

// ── 7. 좁은 화면의 ☰ 서랍 (2026-10-22) ──────────────────────────────────────
//
// 🔴 쓰는 분이 「다 됐는가」를 가르는 기준 다섯. 768px 미만에서 머리말에
//    (1) 알림 종이 있고 (2) 시스템 오가기 단추가 있고 (3) 시스템 이름이 **눈에**
//    보이고 (4) ☰ 가 **맨 왼쪽**에 있고 (5) 화면 메뉴와 계정 칸들이 그 **서랍
//    안**에 들어가 있어야 한다. 아래 시험들이 그 다섯을 하나씩 못 박는다.
//    「글자가 세로로 안 쪼개지니 괜찮다」는 근거가 아니다 — 그것은 ①〜④ 의 일이다.

/** ☰ 묶음(<details>)의 소스. 열고 닫는 자리까지만 잘라 본다. */
function drawerSource(): string {
  const opensAt = appHeader.indexOf("<details");
  assert.ok(opensAt >= 0, "☰ 가 없다 — 좁은 화면 기준 (4) 를 못 채운다");
  const closesAt = appHeader.indexOf("</details>", opensAt);
  assert.ok(closesAt > opensAt, "☰ 의 <details> 가 닫히지 않았다");
  return appHeader.slice(opensAt, closesAt);
}

test("🔴 ⑦ (4) ☰ 가 머리말 **맨 왼쪽**이다 — 시스템 이름보다도 앞", () => {
  const hamburgerAt = appHeader.indexOf("<details");
  const titleAt = appHeader.indexOf("{t.app.title}");
  assert.ok(hamburgerAt >= 0, "☰ 가 없다");
  assert.ok(titleAt > 0, "시스템 이름을 찾지 못했다");
  assert.ok(
    hamburgerAt < titleAt,
    "☰ 가 시스템 이름보다 뒤에 적혀 있다 — 맨 왼쪽이 아니다"
  );

  // 손가락 크기(36px)와 표식. 표식이 없으면 저절로 접히는 장치가 제 ☰ 를 못 찾는다.
  const drawer = drawerSource();
  assert.match(drawer, /data-header-menu=""/, "☰ 에 표식이 없다 — 저절로 안 접힌다");
  assert.match(drawer, /<summary[\s\S]*?className="[^"]*h-9 w-9/, "☰ 가 손가락 크기가 아니다");
  assert.match(drawer, /<summary[\s\S]*?list-none/, "<summary> 앞의 ▶ 삼각형이 남는다");
  assert.match(drawer, /webkit-details-marker/, "사파리에서는 ▶ 삼각형이 남는다");
});

test("🔴 ⑦ (5) 화면 메뉴와 계정 칸이 ☰ 서랍 **안**에 있다", () => {
  const drawer = drawerSource();
  for (const [needle, label] of [
    // 🔵 화면 링크는 공용 조각으로 들어간다 — 서랍에는 그 조각을 부르는 자리가 보인다
    //    (조각 **안**의 두 모습은 바로 아래 「메뉴가 한 벌이다」 시험이 본다).
    ['variant="panel"', "화면 메뉴(알림 설정)"],
    ["<LanguageSwitch", "언어 전환"],
    ["{user.displayName}", "이름·역할"],
    ["href={portalUrl}", "통합 로그인으로"],
    ["action={logoutAction}", "로그아웃"],
  ] as const) {
    assert.ok(drawer.includes(needle), `${label} 이 서랍 밖에 남아 있다 — 폰에 알약으로 늘어선다`);
  }
});

test("🔴 ⑦ (1)(2)(3) 종·시스템 메뉴·이름은 서랍에 **안** 들어간다", () => {
  const drawer = drawerSource();
  // (1) 알림 종 — 접힌 서랍 안에서 기다리면 안 되는 것이고, 자리가 어긋나면
  //     펼친 목록이 화면 밖으로 잘린다.
  assert.equal(drawer.includes("{notificationBell}"), false, "종이 서랍 안으로 들어갔다");
  assert.ok(appHeader.includes("{notificationBell}"), "머리말에 종이 없다");
  // (2) 시스템 오가기 단추.
  assert.equal(drawer.includes("{serviceMenu}"), false, "시스템 메뉴가 서랍 안으로 들어갔다");
  // (3) 시스템 이름 — 눈에 보여야 한다(감추는 것은 ④ 시험이 따로 막는다).
  assert.equal(drawer.includes("{t.app.title}"), false, "시스템 이름이 서랍 안으로 들어갔다");

  // 종이 줄의 **맨 끝**이다 — 펼친 목록이 종에 오른쪽 끝을 맞춰 열린다.
  const bellAt = appHeader.indexOf("{notificationBell}");
  const menuAt = appHeader.indexOf("{serviceMenu}");
  assert.ok(bellAt > menuAt, "종이 시스템 메뉴보다 앞에 있다");
  assert.equal(
    appHeader.slice(bellAt).includes("href="),
    false,
    "종 뒤에 또 무언가가 선다 — 펼친 목록이 화면 밖으로 밀린다"
  );
});

test("🔴 ⑦ 메뉴가 **한 벌**이다 — 자격 규칙이 갈리지 않는다", () => {
  // 넓은 화면의 한 줄과 서랍이 같은 조각(ScreenLinks)을 쓴다. 베껴 두면
  // ADMIN 규칙이 두 벌이 되어 폰과 컴퓨터가 서로 다른 메뉴를 그린다.
  const uses = [...appHeader.matchAll(/<ScreenLinks[^/]*variant="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(uses.sort(), ["bar", "panel"], "같은 조각을 두 자리에서 쓰지 않는다");

  const gates = [...appHeader.matchAll(/user\.role !== "ADMIN"/g)];
  assert.equal(gates.length, 1, "알림 설정의 자격 규칙이 한 곳이 아니다 — 두 벌이 됐다");

  // 두 모습 다 그 조각 **안**에서만 그려진다.
  const screenLinksAt = appHeader.indexOf("function ScreenLinks");
  const headerAt = appHeader.indexOf("export function AppHeader");
  assert.ok(screenLinksAt >= 0 && headerAt > screenLinksAt);
  const links = [...appHeader.matchAll(/href="\/settings\/notify"/g)].map((m) => m.index ?? -1);
  assert.equal(links.length, 2, "알림 설정 링크가 둘이 아니다(한 줄용·서랍용)");
  for (const at of links) {
    assert.ok(at < headerAt, "알림 설정 링크가 공용 조각 밖에 적혀 있다 — 두 벌이다");
  }
});

test("🔴 ⑦ ☰ 와 글자 묶음의 기준점이 **짝**이다 — 768px", () => {
  // 어긋나면 그 사이 폭에서 메뉴가 두 벌로 보이거나 한 벌도 안 보인다.
  assert.match(drawerSource(), /^<details className="[^"]*md:hidden"/, "☰ 가 넓은 화면에도 남는다");
  assert.match(
    appHeader,
    /<div className="hidden flex-wrap items-center gap-3 md:flex">/,
    "글자 묶음이 좁은 화면에서 감춰지지 않는다 — 서랍과 머리말에 두 벌로 보인다"
  );
  // @dss/ui 의 단추가 이름을 감추는 폭과도 같아야 한다(위 ② 시험과 같은 값).
  const menuCss = repoFile("vendor/dss-ui/src/service-menu/service-menu.css");
  assert.match(menuCss, /@media not all and \(min-width: 768px\)/);
});

test("🔴 ⑦ 서랍이 왼쪽에서 나와 화면을 덮고, 검은 바탕으로 닫힌다", () => {
  const drawer = drawerSource();
  // 화면에 매달린다 — 머리말에 매달리면 머리말 높이만 덮는다.
  assert.match(drawer, /className="fixed inset-0 [^"]*flex"/, "서랍이 화면을 덮지 않는다");
  // 패널은 왼쪽 256px.
  assert.match(drawer, /className="relative z-50 flex min-h-0 w-64 flex-col/, "서랍 패널의 폭·자리가 바뀌었다");
  // 길어지면 제 안에서 구르고, 끝까지 민 스크롤이 뒤 페이지로 새지 않는다.
  for (const needed of ["overflow-y-auto", "overscroll-contain", "min-h-0"]) {
    assert.ok(drawer.includes(needed), `서랍에 ${needed} 이 없다 — 가로로 눕힌 폰에서 끝이 잘린다`);
  }
  // 🔴 검은 바탕은 <button type="button"> 이다. <div> 면 눌러도 아무 일이 없고,
  //    type 이 없으면 기본값 submit 이라 같은 서랍의 폼이 날아간다.
  assert.match(
    drawer,
    /<button\s+type="button"\s+aria-label=\{t\.nav\.menuClose\}\s+className="absolute inset-0 bg-black\/40"/,
    "검은 바탕이 닫히는 단추가 아니다"
  );
});

test("🔴 ⑦ 바닥 묶음은 **빈 칸막이**로 붙인다 — mt-auto 가 아니다", () => {
  const drawer = drawerSource();
  // mt-auto 는 메뉴가 서랍보다 길어지는 순간 0 으로 풀려 구분선 위 간격이 사라진다.
  assert.equal(drawer.includes("mt-auto"), false, "mt-auto 를 썼다 — 메뉴가 길어지면 간격이 사라진다");
  assert.match(drawer, /<div aria-hidden="true" className="grow" \/>/, "빈 칸막이를 지웠다 — 바닥에 안 붙는다");
  assert.match(drawer, /className="mt-3 flex flex-col items-stretch gap-2 border-t/, "구분선 위 간격이 사라졌다");
});

test("🔴 ⑦ 서랍이 종·시스템 메뉴의 펼친 목록보다 **위**다", () => {
  // 🔴 여는 대괄호를 따로 이어 붙이는 까닭은 위 ⑤ 시험과 같다.
  const OPEN_BRACKET = "\\[";
  const zUtility = new RegExp(`\\bz-${OPEN_BRACKET}?(\\d+)`, "g");
  const levels = [...drawerSource().matchAll(zUtility)].map((m) => Number(m[1]));
  assert.ok(levels.length >= 2, "서랍에 z 가 모자라다(덮개와 패널 둘이어야 한다)");
  assert.ok(
    Math.max(...levels) > 50,
    `서랍이 ${Math.max(...levels)} 이라 펼친 목록(@dss/ui 의 50)에 가린다`
  );
});

test("🔴 ⑦ 머리말은 **서버 컴포넌트**로 남는다 — 경계는 새 파일 하나다", () => {
  // 🔴 주석을 뗀 글자에서 센다. 주석에 그 낱말을 적어 두면 셈이 1 이 되어 속는다.
  assert.equal(
    appHeader.includes("use client"),
    false,
    "머리말이 클라이언트로 내려갔다 — 시험이 다 통과해도 build 에서만 드러나는 결함이 난다"
  );
  assert.equal(appHeader.includes("useState"), false, "여닫기를 상태로 바꿨다 — 경계가 깨진다");

  // 경계는 아무것도 그리지 않는 조각 하나다.
  const dismiss = repoFile("src/components/HeaderMenuDismiss.tsx");
  assert.match(dismiss, /^"use client";/, "저절로 접는 조각이 클라이언트가 아니다 — 아무 일도 안 한다");
  assert.ok(drawerSource().includes("<HeaderMenuDismiss />"), "그 조각이 ☰ 안에 놓여 있지 않다");
});
