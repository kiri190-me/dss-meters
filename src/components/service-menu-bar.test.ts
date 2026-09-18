/**
 * ============================================================================
 * 서비스 메뉴바가 이 저장소에 **붙은 자리**
 * ============================================================================
 * 메뉴바 자체(@dss/ui)는 그쪽 저장소의 시험이 본다. 여기서 지키는 것은 이
 * 저장소가 그것을 어떻게 쓰느냐다 — 어디에 앉혔는지, 「지금 여기」로 무엇을
 * 넘기는지, 폰에서 머리말이 층을 다시 만들지 않는지, 종이에 나오지 않는지.
 *
 * 🔴 2026-09-18 부터 메뉴바는 머리말 **위**가 아니라 **안**에 앉는다(회색 층이
 * 하나 더 생겨 답답하다는 사용자 지적 — A/S 가 먼저 같은 일을 했다).
 *
 * 조각은 **직접 불러** 나온 요소 나무를 본다(react-dom 없이). 상태도 훅도 없는
 * 순수 함수라 그냥 부르면 된다.
 * ============================================================================
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ServiceMenuBar } from "@dss/ui";

import { ko } from "@/lib/i18n/ko";
import { ja } from "@/lib/i18n/ja";

/** 이 앱의 client_id — 포털에 등록된 이름이자 ID 토큰의 aud 다. */
const THIS_SERVICE_ID = "dss-meters";

const SERVICES = [
  { id: "rf-service-system", name: "A/S 관리", url: "http://10.0.0.5:3000", icon: "🔧" },
  { id: THIS_SERVICE_ID, name: "계측기 관리", url: "http://10.0.0.5:3300" },
  { id: "dss-improvements", name: "개선요청", url: "http://10.0.0.5:3400" },
];

type RenderedElement = { type: unknown; props: Record<string, unknown> };

function isElement(value: unknown): value is RenderedElement {
  return typeof value === "object" && value !== null && "props" in value && "type" in value;
}

/** 나온 나무에서 <a> 만 차례대로 줍는다. */
function links(node: unknown, found: RenderedElement[] = []): RenderedElement[] {
  if (Array.isArray(node)) {
    for (const child of node) links(child, found);
    return found;
  }
  if (!isElement(node)) return found;
  if (node.type === "a") found.push(node);
  links(node.props.children, found);
  return found;
}

const repoFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

/** 주석 안의 말(이 저장소는 주석이 길다)이 아래 단언에 걸리지 않게 걷어낸다. */
const withoutComments = (source: string) =>
  source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const appHeader = repoFile("src/components/AppHeader.tsx");
const internalLayout = repoFile("src/app/(internal)/layout.tsx");
const menuCss = repoFile("vendor/dss-ui/src/service-menu/service-menu.css");

// ── 메뉴바가 그리는 것 ──────────────────────────────────────────────────────

test("🔴 지금 사이트(dss-meters) 칸만 눌린 상태로 그려진다", () => {
  const rendered = ServiceMenuBar({
    services: SERVICES,
    currentServiceId: THIS_SERVICE_ID,
    variant: "inline",
  });
  const anchors = links(rendered);

  assert.equal(anchors.length, 3);
  assert.deepEqual(
    anchors.map((anchor) => anchor.props["data-service-id"]),
    ["rf-service-system", THIS_SERVICE_ID, "dss-improvements"],
    "받은 차례 그대로 그리지 않는다"
  );
  assert.deepEqual(
    anchors.map((anchor) => anchor.props["data-current"]),
    ["false", "true", "false"]
  );
  assert.deepEqual(
    anchors.map((anchor) => anchor.props["aria-current"]),
    [undefined, "page", undefined],
    "색 말고 aria-current 로도 「지금 여기」를 알려야 한다"
  );
});

test("목록이 비면 아무것도 그리지 않는다 — 빈 자리도 남기지 않는다(포털 배포 전 상태)", () => {
  assert.equal(
    ServiceMenuBar({ services: [], currentServiceId: THIS_SERVICE_ID, variant: "inline" }),
    null
  );
});

// ── 이 저장소가 붙인 자리 ───────────────────────────────────────────────────

test("🔴 메뉴바는 머리말 **안**에 앉는다 — layout 이 머리말에 내려보낸다", () => {
  const bare = withoutComments(internalLayout);
  const headerAt = bare.indexOf("<AppHeader");
  const barAt = bare.indexOf("<ServiceMenuBar");

  assert.ok(headerAt > 0, "layout 이 머리말을 그리지 않는다");
  assert.ok(barAt > headerAt, "메뉴바가 머리말 밖(위)에 있다 — 안으로 들어가야 한다");
  assert.match(bare, /serviceMenu=\{/, "머리말에 내려보내지 않는다");

  // 머리말 위 회색 띠가 아니라 머리말 바탕 위에 그대로 얹히는 모습이어야 한다.
  assert.match(bare.slice(barAt), /variant="inline"/);

  // 세로 flex 안에서 눌리지 않게 하던 클래스. 이제는 반대로 **줄어들 수
  // 있어야** 한다 — 남아 있으면 좁은 화면에서 로그아웃을 밀어낸다.
  assert.equal(
    bare.includes("shrink-0"),
    false,
    "띠로 앉히던 때의 shrink-0 이 남아 있다"
  );
});

test("🔴 머리말은 시스템 이름 다음, 오른쪽 글자 묶음 앞에 그린다", () => {
  const bare = withoutComments(appHeader);
  const titleAt = bare.indexOf("{t.app.title}");
  const menuAt = bare.indexOf("{serviceMenu}");
  const rightAt = bare.indexOf('className="ml-auto');

  assert.ok(menuAt > 0, "머리말이 메뉴바를 그리지 않는다");
  assert.ok(titleAt > 0 && titleAt < menuAt, "시스템 이름보다 앞에 그린다");
  assert.ok(menuAt < rightAt, "오른쪽 글자 묶음보다 뒤에 그린다");
});

test("🔴 메뉴바는 남는 자리만 쓴다 — 로그아웃·포털이 밀려나지 않는다", () => {
  const bare = withoutComments(appHeader);

  // 🔴 `shrink-0` 이다(2026-09-18 오후). 예전의 `min-w-0 flex-auto md:flex-1`
  // 은 「**가로로 늘어선 목록**에 남는 자리를 준다」는 장치였다 — 기준 폭 0 에
  // 목록이 제 안에서 굴러가는 짝. 메뉴바가 **드롭다운 단추 하나**가 된 뒤로는
  // 그리는 것이 `white-space: nowrap` 인 단추뿐이라 **줄어들지 못한다**:
  // 기준 폭을 0 으로 두면 자리가 모자랄 때 단추가 제 칸 밖으로 삐져나와
  // 오른쪽 글자와 겹친다(768px 에서 이 칸 몫 87px < 단추 130px).
  // `shrink-0` 이면 겹치는 대신 오른쪽 묶음이 flex-wrap 으로 줄을 바꾼다.
  assert.match(bare, /<div className="shrink-0">\{serviceMenu\}<\/div>/);

  // 되돌아가는 것을 막는다 — 위 둘은 드롭다운에서 뜻이 어긋난다.
  assert.equal(
    /className="[^"]*\bflex-(1|auto)\b/.test(bare),
    false,
    "메뉴 칸에 flex-1/flex-auto 가 돌아왔다 — 단추는 줄어들지 못해 글자와 겹친다"
  );

  // 🔴 이 머리말의 선: 로그아웃과 포털은 없애지 않는다(들어갈 자리가 없다고
  // 지우는 순간 폰에서 나갈 길이 사라진다).
  assert.match(bare, /\{t\.nav\.portal\}/, "포털 버튼이 사라졌다");
  assert.match(bare, /\{t\.nav\.logout\}/, "로그아웃 버튼이 사라졌다");
});

test("🔴 flex-wrap 은 그대로다 — 끄면 버튼 안에서 글자가 접힌다", () => {
  // 이름 120 + 단추 59 + 오른쪽 묶음 246 + 여백 32 = 457 이라 폰(360px)의
  // 안쪽 폭 328px 을 넘는다. 줄바꿈을 끄면 칸들이 min-content 밑으로 눌려
  // "통합 / 로그인으로" 처럼 접힌다 — 오른쪽 묶음을 통째로 둘째 줄로
  // 내려보내는 편이 낫다. 🔴 메뉴 칸이 `shrink-0` 이 된 뒤로는 줄 나누기에
  // **참여한다**(예전엔 기준 폭 0 이라 참여하지 않았다) — 아래 폭 셈 시험이
  // 그 결과가 몇 줄인지 못 박는다.
  const bare = withoutComments(appHeader);
  assert.match(bare, /className="mx-auto flex max-w-\[1400px\] flex-wrap/);
});

test("🔴 폰(360px)에서 시스템 이름과 메뉴 단추가 한 줄에 함께 선다", () => {
  // 실측(Windows·Malgun Gothic, 브라우저와 같은 글꼴 대체 순서)에서 나온 값들.
  // 여기서 지키는 것은 「이름이 더 길어지면 단추가 둘째 줄로 밀린다」는 선이다 —
  // 그렇게 되면 폰 첫 줄이 이름 하나뿐인 빈 줄이 된다.
  const INNER = 360 - 16 * 2; // px-4 좌우
  const GAP = 16; // gap-x-4
  const CO = 22 + 8; // "DSS"(12px) + gap-2
  // 🔴 폰의 드롭다운 **단추 하나** 폭(@dss/ui `.dss-menu__summary`, pointer:
  // coarse): 좌우 여백 24 + 아이콘 19 + gap 6 + 삼각형 8 + 그 왼쪽 여백 2.
  // 예전 「아이콘만인 칸 셋 123px」을 대신하는 값이고, 서비스가 다섯이 되어도
  // 그대로다 — 그것이 드롭다운으로 바꾼 이유다.
  const BUTTON = 24 + 19 + 6 + 8 + 2;

  // 18px 글자 폭 어림: 한글·가나·한자는 한 글자가 한 칸, 빈칸은 0.28칸.
  // tracking-tight(-0.025em)만큼 도로 뺀다.
  const titleWidth = (title: string) => {
    const cells = [...title].reduce((sum, ch) => sum + (ch === " " ? 0.28 : 1), 0);
    return cells * 18 - [...title].length * 18 * 0.025;
  };

  for (const [lang, dict] of [
    ["ko", ko],
    ["ja", ja],
  ] as const) {
    const left = titleWidth(dict.app.title) + CO;
    const firstRow = left + GAP + BUTTON;
    assert.ok(
      firstRow <= INNER,
      `${lang}: 이름 ${Math.round(left)}px + 여백 ${GAP} + 단추 ${BUTTON} = ` +
        `${Math.round(firstRow)}px 이라 폰 속폭 ${INNER}px 을 넘는다 — 단추가 둘째 줄로 밀린다`
    );
  }

  // 🔴 일본어가 한국어보다 길지 않아야 이 셈이 두 언어 모두에서 성립한다.
  assert.ok(
    titleWidth(ja.app.title) <= titleWidth(ko.app.title),
    "일본어 이름이 한국어보다 길어졌다 — 폰 폭 셈을 다시 해야 한다"
  );
});

test("🔴 폰에서 아이콘만 남는 것은 **단추**다 — 펼친 목록은 이름을 그대로 보인다", () => {
  // 그 동작은 @dss/ui 가 CSS 로 한다(그쪽 시험이 자세히 본다). 여기서는 이
  // 저장소가 기대는 그 규칙이 실제로 실려 있는지만 확인한다.
  //
  // 🔴 겨냥이 2026-09-18 오후에 바뀌었다. 예전에는 `.dss-menu__name`(= 칸의
  // 이름)이 폰에서 감춰졌는데, 이제 감추는 것은 `.dss-menu__label`(= **단추**에
  // 선 이름)이다. `.dss-menu--inline .dss-menu__name` 규칙은 지금도 있지만
  // 뜻이 전혀 다르다(긴 이름을 … 로 끊는 것) — 그것을 겨냥한 채 두면 시험은
  // 초록인데 설명은 거짓인 상태가 된다.
  const phoneBlock = menuCss.match(
    /@media not all and \(min-width: 768px\) \{([\s\S]*?)\n\}/
  );
  assert.ok(phoneBlock, "폰 기준점(768px) 블록을 찾지 못했다");
  assert.match(
    phoneBlock[1],
    /\.dss-menu--inline \.dss-menu__label \{/,
    "폰에서 단추의 이름을 감추는 규칙이 없다 — 단추가 이름까지 싣고 자리를 다툰다"
  );
  // 이름은 눈에서만 감춘다 — 낭독기는 그대로 읽어야 한다.
  assert.match(phoneBlock[1], /clip-path: inset\(50%\)/);
  // 펼친 목록의 이름은 폰에서도 보인다(그 블록 안에 __name 을 감추는 규칙이 없다).
  assert.equal(
    /\.dss-menu__name \{[^}]*clip-path/.test(phoneBlock[1]),
    false,
    "펼친 목록의 이름까지 감췄다 — 이모지만 늘어선 목록은 고를 수가 없다"
  );

  // 머리말 안에 앉는 **드롭다운**이 실제로 실려 있다(서브모듈 포인터가 옛
  // 커밋이면 여기서 걸린다 — 그 판에는 단추도 펼친 목록도 없다).
  assert.match(menuCss, /\.dss-menu\.dss-menu--inline \{/);
  assert.match(menuCss, /\.dss-menu--inline \.dss-menu__dropdown \{/);
  assert.match(menuCss, /\.dss-menu--inline \.dss-menu__summary \{/);
});

test("🔴 펼친 목록은 머리말 밖으로 **떠서** 그려진다 — 자르는 조상이 없어야 한다", () => {
  // 목록이 position: absolute 라 머리말 높이를 넘어간다. 감싸는 쪽 어딘가에
  // overflow: hidden 이 있으면 목록이 잘려 **아무것도 고를 수 없다**.
  const listRule = menuCss.match(/\.dss-menu--inline \.dss-menu__list \{([\s\S]*?)\n\}/);
  assert.ok(listRule, "펼친 목록 규칙을 찾지 못했다");
  assert.match(listRule[1], /position: absolute;/);
  assert.match(listRule[1], /z-index: 50;/);

  // 머리말부터 최상위까지 자르는 줄이 없다. (Tailwind 로 걸면 overflow-hidden,
  // CSS 로 걸면 overflow: hidden 이다.)
  for (const relativePath of [
    "src/components/AppHeader.tsx",
    "src/app/(internal)/layout.tsx",
    "src/app/layout.tsx",
  ]) {
    const bare = withoutComments(repoFile(relativePath));
    assert.equal(
      /\boverflow-hidden\b|\boverflow-(x-|y-)?clip\b/.test(bare),
      false,
      `${relativePath} 가 overflow 를 자른다 — 펼친 목록이 잘려 고를 수 없게 된다`
    );
  }
  // 화면 전체에 거는 규칙도 없다.
  assert.equal(
    /\b(html|body)\s*\{[^}]*overflow[^}]*hidden/.test(repoFile("src/app/globals.css")),
    false,
    "globals.css 가 html/body 를 잘라 놓았다"
  );
});

test("🔴 layout 이 목록과 「지금 여기」를 서버에서 풀어 내려보낸다", () => {
  const bare = withoutComments(internalLayout);
  assert.match(bare, /const services = await readServiceMenu\(\);/);
  assert.match(bare, /services\.length > 0 \? env\.ssoClientId : null/);
  assert.match(bare, /services=\{services\}/);
  assert.match(bare, /currentServiceId=\{currentServiceId\}/);
  assert.match(bare, /label=\{t\.nav\.serviceMenu\}/);
});

test("생김새를 부르는 줄이 있다 — 없으면 메뉴바가 모양 없이 뜬다", () => {
  assert.ok(repoFile("src/app/layout.tsx").includes('import "@dss/ui/styles.css";'));
});

// ── 이 저장소만의 제약 ──────────────────────────────────────────────────────

test("🔴 인쇄에는 나오지 않는다 — 머리말·메뉴바·@dss/ui 세 겹", () => {
  const bare = withoutComments(appHeader);
  assert.match(bare, /<header className="no-print/, "머리말이 no-print 를 잃었다");
  assert.match(withoutComments(internalLayout), /className="no-print"/);
  assert.match(menuCss, /@media print \{\s*\.dss-menu \{\s*display: none !important;/);
});

test("🔴 다크 유틸리티를 들이지 않는다 — 이 저장소는 라이트 고정이다", () => {
  // color-scheme: light 로 못 박혀 있어(globals.css) `dark:` 를 쓰면 OS 가
  // 어두운 사람에게 이 한 줄만 까맣게 뜬다. 메뉴바 쪽도 colorScheme 기본값
  // "host" 그대로 둔다 — 넘기면 그 판단을 여기서 두 번 하게 된다.
  assert.equal(withoutComments(appHeader).includes("dark:"), false);
  assert.equal(withoutComments(internalLayout).includes("colorScheme"), false);
  assert.match(repoFile("src/app/globals.css"), /color-scheme: light;/);
});

test("🔴 없는 문제를 만들지 않는다 — 이 저장소에 노치 인셋은 한 곳도 없다", () => {
  // viewport-fit=cover 를 쓰지 않으므로 env(safe-area-inset-top) 이 늘 0 이다.
  // inline 모습은 padding-top 을 0 으로 못 박아 두므로 켤 것도 끌 것도 없다.
  assert.equal(withoutComments(appHeader).includes("safe-area-inset"), false);
  assert.equal(withoutComments(internalLayout).includes("safe-area-inset"), false);
  assert.match(menuCss, /\.dss-menu\.dss-menu--inline \{[\s\S]*?padding-top: 0;/);
});

test("두 언어 모두 메뉴바 이름을 갖는다 — 낭독기가 읽는 글자다", () => {
  for (const dict of [ko, ja]) {
    assert.ok(dict.nav.serviceMenu.trim().length > 0);
  }
});
