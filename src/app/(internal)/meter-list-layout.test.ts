/**
 * ============================================================================
 * 목록 화면이 폰에서 가지런한가
 * ============================================================================
 * 🔴 2026-09-18 사용자 폰 사진에서 셋이 걸렸다:
 *
 *  ① 현황판 줄 끝에 구분점만 덩그러니 남았다 — 「전체 76대 · 기한초과 11 ·」.
 *     구분점이 독립된 flex 항목이라 앞 통계와 함께 줄을 넘지 못한다.
 *  ② 현황판 줄마다 정렬이 달랐다 — 통계 둘은 왼쪽, 단추 줄만 오른쪽.
 *  ③ 엑셀·인쇄 단추가 「자산」 줄 옆에만 붙어 「상태」 줄 오른쪽이 비었다.
 *
 * 🔴 셋 다 좁은 화면에서만 고친다. 640px 부터는 예전 그대로 그려져야 한다 —
 * 아래 시험마다 「폰에서 이렇게」와 「넓은 화면에서 예전대로」를 **짝으로**
 * 확인한다. 한쪽만 보면 넓은 화면을 몰래 바꿔 놓고도 통과한다.
 * ============================================================================
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const withoutComments = (source: string) =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const listPage = withoutComments(repoFile("src/app/(internal)/page.tsx"));

/** 현황판(요약 카드) 상자의 클래스. */
function summaryCardClasses(): string[] {
  const card = listPage.match(/className="(no-print grid[^"]*)"/);
  assert.ok(card, "현황판 상자를 찾지 못했다");
  return card[1].split(/\s+/);
}

// ── ① 구분점이 줄 끝에 홀로 남지 않는다 ─────────────────────────────────────

test("🔴 ① 구분점은 폰에서 아예 그려지지 않는다 — 홀로 남을 수가 없다", () => {
  const dots = [...listPage.matchAll(/<span className="([^"]*)">·<\/span>/g)].map(
    (m) => m[1],
  );
  assert.equal(dots.length, 3, "통계 넷 사이의 구분점이 셋이 아니다");

  for (const classes of dots) {
    const parts = classes.split(/\s+/);
    // display:none 이라 격자 칸도 차지하지 않는다. 줄 끝에 남을 칸 자체가 없다.
    assert.ok(parts.includes("hidden"), "폰에서 구분점이 그대로 남아 줄 끝에 홀로 선다");
    // 🔴 넓은 화면에서는 예전 그대로 돌아온다.
    assert.ok(parts.includes("sm:inline"), "넓은 화면에서 구분점이 사라졌다");
    assert.ok(parts.includes("text-slate-300"), "구분점 색이 달라졌다");
  }
});

test("🔴 ① 폰에서는 격자가 대신 칸을 가른다 — 구분점 없이도 읽힌다", () => {
  const classes = summaryCardClasses();
  assert.ok(classes.includes("grid"), "현황판이 격자가 아니다");
  assert.ok(classes.includes("grid-cols-2"), "통계 넷이 2×2 로 서지 않는다");
});

// ── ② 현황판 정렬 ───────────────────────────────────────────────────────────

test("🔴 ② 단추 둘이 한 묶음으로 폰에서 제 줄을 갖고, 손가락 크기다", () => {
  const group = listPage.match(/className="(col-span-2[^"]*)"/);
  assert.ok(group, "단추를 감싼 묶음을 찾지 못했다");
  const groupClasses = group[1].split(/\s+/);

  // 폰: 격자 두 칸을 다 써서 제 줄이 된다.
  assert.ok(groupClasses.includes("col-span-2"), "단추 줄이 한 칸만 차지한다");
  // 🔴 넓은 화면: 예전처럼 오른쪽 끝으로 가고, 단추 사이 간격도 예전 값(20px).
  assert.ok(groupClasses.includes("sm:ml-auto"), "넓은 화면에서 단추가 오른쪽 끝에 안 간다");
  assert.ok(groupClasses.includes("sm:gap-x-5"), "넓은 화면에서 단추 사이 간격이 달라졌다");
  assert.ok(groupClasses.includes("sm:mt-0"), "넓은 화면에 없던 위 여백이 생긴다");

  // 단추 둘: 폰에서 폭을 반씩 나눠 갖고 py-3(=40px 높이)이라 눌린다.
  const buttons = [...listPage.matchAll(/<Link\s+href="(\/certificates|\/meters\/new)"\s+className="([^"]*)"/g)];
  assert.equal(buttons.length, 2, "단추가 둘이 아니다 — 기능이 사라졌는지 보라");
  for (const [, href, classes] of buttons) {
    const parts = classes.split(/\s+/);
    assert.ok(parts.includes("flex-1"), `${href}: 폰에서 폭을 나눠 갖지 않는다`);
    assert.ok(parts.includes("py-3"), `${href}: 폰에서 너무 낮아 손가락으로 눌리지 않는다`);
    // 🔴 넓은 화면에서는 제 내용 폭·예전 높이로 돌아온다.
    assert.ok(parts.includes("sm:flex-none"), `${href}: 넓은 화면에서 단추가 늘어난다`);
    assert.ok(parts.includes("sm:py-1.5"), `${href}: 넓은 화면에서 단추가 두꺼워진다`);
  }
});

test("🔴 ② 넓은 화면의 현황판은 예전 그대로 한 줄 flex 다", () => {
  const classes = summaryCardClasses();
  // sm 부터 display:grid 를 덮는다 — 이것이 없으면 넓은 화면이 2칸으로 접힌다.
  assert.ok(classes.includes("sm:flex"), "넓은 화면에서도 격자로 남아 배치가 달라진다");
  assert.ok(classes.includes("sm:flex-wrap"), "넓은 화면에서 줄바꿈이 사라졌다");
  // 여백·정렬·생김새는 예전 값 그대로여야 한다.
  for (const kept of ["items-center", "gap-x-5", "gap-y-1", "px-4", "py-2.5", "text-sm", "no-print"]) {
    assert.ok(classes.includes(kept), `현황판의 ${kept} 가 사라졌다`);
  }
});

test("🔴 ② 기능이 그대로다 — 미등록 성적서·계측기 등록 둘 다 눌린다", () => {
  assert.match(listPage, /href="\/certificates"/, "미등록 성적서로 가는 길이 사라졌다");
  assert.match(listPage, /href="\/meters\/new"/, "계측기 등록으로 가는 길이 사라졌다");
  assert.match(listPage, /\{t\.cert\.unassigned\}/);
  assert.match(listPage, /\{t\.list\.add\}/);
  // 관리자에게만 보이던 조건은 그대로다.
  assert.match(listPage, /\{admin && \(/);
  assert.match(listPage, /\{unassigned > 0 && \(/);
});

// ── ③ 거르개와 동작 단추 ────────────────────────────────────────────────────

test("🔴 ③ 폰에서 거르개가 제 줄을 통째로 쓴다 — 단추 둘은 아래 줄로", () => {
  const box = listPage.match(/className="(w-full sm:w-auto[^"]*)"[^>]*>\s*<FilterBar/);
  assert.ok(box, "거르개를 감싼 칸을 찾지 못했다");
  const classes = box[1].split(/\s+/);

  assert.ok(classes.includes("w-full"), "폰에서 거르개가 단추와 같은 줄에 눌려 들어간다");
  // 🔴 넓은 화면: 예전 그대로 남는 자리만 쓴다.
  assert.ok(classes.includes("sm:min-w-0"), "넓은 화면에서 거르개가 줄어들지 못한다");
  assert.ok(classes.includes("sm:flex-1"), "넓은 화면에서 거르개가 남는 자리를 안 쓴다");
  assert.ok(classes.includes("sm:w-auto"), "넓은 화면에서 거르개가 줄을 통째로 먹는다");
});

test("🔴 ③ 엑셀·인쇄·기본 정렬은 그대로 남아 있다", () => {
  assert.match(listPage, /\/api\/meters\/export/, "엑셀 내려받기가 사라졌다");
  assert.match(listPage, /\{t\.list\.exportExcel\}/);
  assert.match(listPage, /<PrintButton t=\{t\} \/>/, "인쇄 단추가 사라졌다");
  assert.match(listPage, /\{t\.list\.defaultSort\}/, "기본 정렬이 사라졌다");
});

// ── 손대지 않기로 한 것 ─────────────────────────────────────────────────────

test("🔴 표는 그대로다 — 제 상자 안에서 가로로 굴러가는 것이 설계다", () => {
  assert.match(
    listPage,
    /className="print-table overflow-x-auto rounded-lg border border-slate-200 bg-white"/,
    "표를 감싼 상자가 달라졌다",
  );
  assert.match(listPage, /<table className="min-w-full border-collapse">/);
});
