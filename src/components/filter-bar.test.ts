/**
 * ============================================================================
 * 거르개가 폰에서 가지런한가
 * ============================================================================
 * 🔴 2026-09-18 사용자 폰 사진에서 둘이 걸렸다:
 *
 *  ⓐ 「자산」·「상태」 두 줄의 **오른쪽 끝이 어긋났다.** 선택칸이 제 목록 중
 *     가장 긴 항목에 맞춰 폭이 정해지는데 두 목록의 길이가 달라서다.
 *  ⓑ 검색 안내글이 「… · S」 에서 **잘렸다.** placeholder 는 글자라 CSS 로
 *     감추거나 줄일 수 없어, 폰용 짧은 글을 따로 둔다.
 *
 * 🔴 둘 다 좁은 화면에서만이다 — 768px 부터는 이 변경 전과 똑같이 그려진다.
 * ============================================================================
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ko } from "@/lib/i18n/ko";
import { ja } from "@/lib/i18n/ja";

const repoFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const withoutComments = (source: string) =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const filterBar = withoutComments(repoFile("src/components/FilterBar.tsx"));

/** 글자 폭 어림(px) — app-header.test.ts 와 같은 셈법. */
function textWidth(text: string, fontSize: number): number {
  const cells = [...text].reduce((sum, ch) => {
    if (ch === " ") return sum + 0.28;
    return sum + (/[\x20-\x7E]/.test(ch) ? 0.55 : 1);
  }, 0);
  return cells * fontSize;
}

// ── ⓐ 두 줄이 나란히 선다 ───────────────────────────────────────────────────

test("🔴 폰에서 거르개 두 칸의 폭이 같다 — 오른쪽 끝이 맞는다", () => {
  const labels = [...filterBar.matchAll(/<label className="([^"]*)">/g)].map((m) => m[1]);
  assert.equal(labels.length, 2, "거르개 라벨이 둘이 아니다(자산·상태)");

  for (const classes of labels) {
    const parts = classes.split(/\s+/);
    // 두 라벨이 같은 폭(줄 전체)을 쓰면 왼쪽 끝도 오른쪽 끝도 저절로 맞는다.
    assert.ok(parts.includes("w-full"), "라벨이 제 내용 폭만 써서 줄마다 끝이 다르다");
    assert.ok(parts.includes("md:w-auto"), "넓은 화면에서 예전 폭으로 돌아오지 않는다");
    // 글자가 접히지 않는 것은 그대로 지킨다("상 / 태").
    assert.ok(parts.includes("whitespace-nowrap"));
  }

  // 선택칸이 그 줄의 남는 자리를 다 채워야 두 칸의 오른쪽 끝이 맞는다.
  const select = filterBar.match(/const selectClass =\s*\n?\s*"([^"]*)"/);
  assert.ok(select, "선택칸 생김새를 찾지 못했다");
  const selectClasses = select[1].split(/\s+/);
  assert.ok(selectClasses.includes("flex-1"), "선택칸이 남는 자리를 채우지 않는다");
  assert.ok(
    selectClasses.includes("min-w-0"),
    "선택칸이 제 가장 긴 항목 폭 밑으로 줄지 못해 줄을 넘긴다"
  );
  assert.ok(selectClasses.includes("md:flex-none"), "넓은 화면의 선택칸 폭이 달라진다");
});

test("두 언어 모두 거르개 라벨이 같은 글자 수다 — 왼쪽 끝도 맞는다", () => {
  for (const dict of [ko, ja]) {
    assert.equal(
      dict.list.owner.length,
      dict.list.status.length,
      "라벨 길이가 달라 선택칸 왼쪽 끝이 어긋난다"
    );
  }
});

// ── ⓑ 안내글이 잘리지 않는다 ────────────────────────────────────────────────

test("🔴 폰에서는 짧은 안내글을 쓴다", () => {
  assert.match(
    filterBar,
    /placeholder=\{\s*narrow \? t\.list\.searchPlaceholderShort : t\.list\.searchPlaceholder\s*\}/,
    "화면 폭에 따라 안내글을 고르지 않는다"
  );
  // 긴 쪽을 지운 것이 아니다 — 넓은 화면은 그대로다.
  assert.match(filterBar, /t\.list\.searchPlaceholder\b/);
});

test("🔴 안내글을 고르는 기준점이 메뉴바·머리말과 같은 768px 이다", () => {
  const narrow = filterBar.match(/const NARROW = "([^"]*)"/);
  assert.ok(narrow, "기준점을 찾지 못했다");
  assert.equal(
    narrow[1],
    "not all and (min-width: 768px)",
    "Tailwind md: 의 정확한 여집합이 아니다 — 그 사이 폭에서 어정쩡해진다"
  );

  const menuCss = repoFile("vendor/dss-ui/src/service-menu/service-menu.css");
  assert.ok(
    menuCss.includes(`@media ${narrow[1]}`),
    "메뉴바가 쓰는 기준점과 글자 하나까지 같지 않다"
  );
});

test("🔴 짧은 안내글이 폰 검색칸 안에 들어간다 — 두 언어 모두", () => {
  // 폰 검색칸의 글자 자리: 360 − px-4×2(바깥) − px-3×2(칸 안쪽) = 304px.
  const ROOM = 360 - 16 * 2 - 12 * 2;
  for (const [lang, dict] of [
    ["ko", ko],
    ["ja", ja],
  ] as const) {
    const short = textWidth(dict.list.searchPlaceholderShort, 14);
    assert.ok(
      short <= ROOM,
      `${lang}: 짧은 안내글이 ${Math.round(short)}px 이라 ${ROOM}px 에 안 들어간다`
    );
    // 긴 쪽보다 실제로 짧아야 줄이는 뜻이 있다.
    assert.ok(
      short < textWidth(dict.list.searchPlaceholder, 14),
      `${lang}: 짧은 안내글이 긴 쪽보다 짧지 않다`
    );
  }
});

test("🔴 화면 폭을 읽는 방식이 effect + setState 가 아니다", () => {
  // 이 저장소에는 react-hooks/set-state-in-effect 규칙이 켜져 있다. 그리고
  // 서버에서는 넓은 화면으로 그려야 서버·클라이언트가 어긋나지 않는다.
  assert.match(filterBar, /useSyncExternalStore\(/);
  assert.match(filterBar, /window\.matchMedia\(NARROW\)/);
  assert.ok(
    filterBar.includes("() => false,"),
    "서버 쪽 기본값이 없다 — 서버에서 window 를 읽다 터진다"
  );
});
