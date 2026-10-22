/**
 * ============================================================================
 * ☰ 서랍이 저절로 접힌다 (2026-10-22)
 * ============================================================================
 * 여닫는 일 자체는 여전히 브라우저가 한다(<details>/<summary>). 이 조각이 더하는
 * 것은 **접히는 때** 셋뿐이다 — 서랍 안의 메뉴를 눌러 화면을 옮겼을 때 · 바깥을
 * 눌렀을 때 · Esc.
 *
 * 🔴 이 저장소에는 jsdom 이 없다(화면을 그려 재는 시험이 아예 없다). 그래서 진짜
 *    DOM 대신 **최소한의 모양**(HeaderMenuHandle)을 넣어 규칙만 잰다. 진짜 DOM 과
 *    이 규칙을 잇는 자리는 소스 글자로 맞대어 본다(아래 ④).
 * ============================================================================
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  dismissAll,
  dismissOnPanelAction,
  dismissOutside,
  watchHeaderMenus,
  type HeaderMenuEventHost,
  type HeaderMenuHandle,
} from "./HeaderMenuDismiss";

const repoFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

const dismissSource = repoFile("src/components/HeaderMenuDismiss.tsx");
const appHeaderSource = repoFile("src/components/AppHeader.tsx");

/**
 * 「어딘가를 눌렀다」를 뜻하는 자리표. 그 자리가 ☰ 안인지 밖인지는 이 값이 아니라
 * 아래 `fakeMenu` 가 정한다 — 여기서 재는 것은 **누른 자리로 무엇을 하는가**뿐이다.
 */
const SOMEWHERE = {} as EventTarget;

/** 접을 수 있는 ☰ 하나를 흉내 낸다. 몇 번 접혔는지 센다. */
function fakeMenu(options: { inside: boolean; panelAction: boolean }) {
  let closed = 0;
  const handle: HeaderMenuHandle = {
    contains: () => options.inside,
    activatesInPanel: () => options.panelAction,
    close: () => {
      closed += 1;
    },
  };
  return { handle, closedCount: () => closed };
}

/** 사건을 받아 두는 가짜 듣는 곳. 붙이고 뗀 것을 그대로 기록한다. */
function fakeHost() {
  const added: { type: string; listener: (event: Event) => void; options: unknown }[] = [];
  const removed: { type: string; listener: (event: Event) => void; options: unknown }[] = [];
  const host: HeaderMenuEventHost = {
    addEventListener: (type, listener, options) => {
      added.push({ type, listener, options });
    },
    removeEventListener: (type, listener, options) => {
      removed.push({ type, listener, options });
    },
  };
  const fire = (type: string, event: Partial<Event> & Record<string, unknown>) => {
    for (const one of added) {
      if (one.type === type) one.listener(event as Event);
    }
  };
  return { host, added, removed, fire };
}

// ── 1. 바깥을 누르면 접힌다 ─────────────────────────────────────────────────

test("🔴 ① ☰ 묶음 밖을 누르면 접힌다", () => {
  const menu = fakeMenu({ inside: false, panelAction: false });
  dismissOutside([menu.handle], {} as EventTarget);
  assert.equal(menu.closedCount(), 1);
});

test("🔴 ① ☰ 묶음 **안**을 누른 것은 바깥이 아니다 — 그 순간에는 접지 않는다", () => {
  // 안을 누른 것은 아래 ② 가 **눌리고 난 뒤**(click) 접는다. 여기서 함께 접으면
  // 눌린 링크가 손 떼기 전에 사라져 click 이 아예 안 난다.
  const menu = fakeMenu({ inside: true, panelAction: true });
  dismissOutside([menu.handle], {} as EventTarget);
  assert.equal(menu.closedCount(), 0);
});

test("🔴 ① 누른 자리를 알 수 없으면 바깥으로 친다", () => {
  const menu = fakeMenu({ inside: false, panelAction: false });
  dismissOutside([menu.handle], null);
  assert.equal(menu.closedCount(), 1);
});

test("🔴 ① 펼쳐진 것이 여럿이면 바깥인 것만 접는다", () => {
  const outside = fakeMenu({ inside: false, panelAction: false });
  const inside = fakeMenu({ inside: true, panelAction: false });
  dismissOutside([outside.handle, inside.handle], {} as EventTarget);
  assert.equal(outside.closedCount(), 1);
  assert.equal(inside.closedCount(), 0);
});

// ── 2. 서랍 안의 메뉴를 누르면 접힌다 ───────────────────────────────────────

test("🔴 ② 서랍의 링크·단추를 누르면 접힌다 — 쓰는 분이 고쳐 달라고 한 그것", () => {
  // 서랍의 링크는 같은 앱 안의 이동이라 머리말이 다시 그려지지 않는다. 접지
  // 않으면 옮겨 간 화면을 서랍이 덮고 있어 ☰ 를 한 번 더 눌러야 한다.
  const menu = fakeMenu({ inside: true, panelAction: true });
  dismissOnPanelAction([menu.handle], {} as EventTarget);
  assert.equal(menu.closedCount(), 1);
});

test("🔴 ② 서랍 안이어도 **가는 것이 아니면** 안 접는다", () => {
  // 이름·역할 배지 같은 맨 글자나 빈 여백을 짚은 것. 거기에 접히면 서랍을 손으로
  // 짚고 읽을 수가 없다.
  const menu = fakeMenu({ inside: true, panelAction: false });
  dismissOnPanelAction([menu.handle], {} as EventTarget);
  assert.equal(menu.closedCount(), 0);
});

test("🔴 ② 바깥을 누른 것은 이쪽에서 접지 않는다 — 그 몫은 ① 이다", () => {
  const menu = fakeMenu({ inside: false, panelAction: false });
  dismissOnPanelAction([menu.handle], {} as EventTarget);
  assert.equal(menu.closedCount(), 0);
});

test("🔴 ② Esc 는 펼쳐진 것을 전부 접는다 — 안이든 바깥이든 가리지 않는다", () => {
  const a = fakeMenu({ inside: true, panelAction: false });
  const b = fakeMenu({ inside: false, panelAction: false });
  dismissAll([a.handle, b.handle]);
  assert.equal(a.closedCount(), 1);
  assert.equal(b.closedCount(), 1);
});

// ── 3. 듣는 사건 셋 ─────────────────────────────────────────────────────────

test("🔴 ③ 폰까지 받으려고 바깥은 pointerdown 으로 듣는다 — 안은 click 이다", () => {
  // iOS 는 빈 바탕의 click 을 문서까지 안 올려 보낸다(바깥). 반대로 안을
  // pointerdown 으로 접으면 눌린 링크가 사라져 click 이 아예 안 난다.
  const { host, added } = fakeHost();
  watchHeaderMenus(host, () => []);
  assert.deepEqual(
    added.map((one) => one.type).sort(),
    ["click", "keydown", "pointerdown"],
    "듣는 사건이 셋이 아니다"
  );
});

test("🔴 ③ 셋 다 capture 로 듣는다 — 중간에서 stopPropagation 을 불러도 들린다", () => {
  const { host, added } = fakeHost();
  watchHeaderMenus(host, () => []);
  for (const one of added) {
    assert.deepEqual(one.options, { capture: true }, `${one.type} 이 capture 가 아니다`);
  }
});

test("🔴 ③ pointerdown 은 바깥만, click 은 서랍 안만 접는다", () => {
  const inside = fakeMenu({ inside: true, panelAction: true });
  const { host, fire } = fakeHost();
  watchHeaderMenus(host, () => [inside.handle]);

  fire("pointerdown", { target: SOMEWHERE });
  assert.equal(inside.closedCount(), 0, "누르는 순간 접혔다 — 링크가 안 눌린다");

  fire("click", { target: SOMEWHERE });
  assert.equal(inside.closedCount(), 1, "눌리고 난 뒤에도 안 접혔다");
});

test("🔴 ③ Esc 만 듣는다 — 글자를 치다 서랍이 접히면 안 된다", () => {
  const menu = fakeMenu({ inside: true, panelAction: false });
  const { host, fire } = fakeHost();
  watchHeaderMenus(host, () => [menu.handle]);

  fire("keydown", { key: "a" });
  assert.equal(menu.closedCount(), 0);
  fire("keydown", { key: "Escape" });
  assert.equal(menu.closedCount(), 1);
});

test("🔴 ③ 사건이 올 때마다 **지금** 펼쳐진 것을 다시 찾는다", () => {
  // 한 번 붙잡아 두면 화면을 옮긴 뒤의 머리말이 아니라 떨어져 나간 마디를 접는다.
  let asked = 0;
  const { host, fire } = fakeHost();
  watchHeaderMenus(host, () => {
    asked += 1;
    return [];
  });
  fire("pointerdown", { target: SOMEWHERE });
  fire("click", { target: SOMEWHERE });
  fire("keydown", { key: "Escape" });
  assert.equal(asked, 3, "한 번 찾아 두고 쓰고 있다");
});

test("🔴 ③ 붙인 것을 **전부** 떼어낸다 — 같은 함수, 같은 옵션으로", () => {
  // 떼지 않으면 화면을 오갈수록 리스너가 쌓여 누를 때마다 하는 일이 늘어난다.
  const { host, added, removed } = fakeHost();
  const stop = watchHeaderMenus(host, () => []);
  stop();
  assert.equal(removed.length, added.length, "뗀 수가 붙인 수와 다르다");
  for (const one of added) {
    assert.ok(
      removed.some(
        (off) =>
          off.type === one.type &&
          off.listener === one.listener &&
          JSON.stringify(off.options) === JSON.stringify(one.options)
      ),
      `${one.type} 을 같은 함수·같은 옵션으로 떼지 않았다 — 브라우저는 다른 리스너로 본다`
    );
  }
});

// ── 4. 두 파일이 **같은 표식**을 쓰는가 ─────────────────────────────────────

test("🔴 ④ 조각이 찾는 표식이 머리말의 <details> 에 실제로 붙어 있다", () => {
  // 한쪽만 바꾸면 **아무것도 안 접히는데 오류도 안 난다.**
  const selector = dismissSource.match(/const OPEN_HEADER_MENUS = "([^"]*)"/);
  assert.ok(selector, "손잡이 선택자를 찾지 못했다");
  const mark = selector[1].match(/\[([\w-]+)\]\[open\]/);
  assert.ok(mark, "선택자가 표식과 [open] 으로 좁혀져 있지 않다");
  assert.ok(
    appHeaderSource.includes(`${mark[1]}=""`),
    `머리말의 ☰ 에 ${mark[1]} 가 없다 — 서랍이 저절로 안 접힌다`
  );
});

test("🔴 ④ `details[open]` 처럼 **넓게 잡지 않는다** — 남의 <details> 까지 접는다", () => {
  // 이 사이트에는 @dss/ui 의 시스템 메뉴와 알림 종이 둘 다 <details> 로 돈다.
  // 넓게 잡으면 그 둘을 펼치려 누르는 순간 함께 접혀 **아예 못 쓴다.**
  const selector = dismissSource.match(/const OPEN_HEADER_MENUS = "([^"]*)"/);
  assert.ok(selector);
  assert.notEqual(selector[1].trim(), "details[open]");
  assert.match(selector[1], /\[open\]/, "접힌 것까지 집는다");
});

test("🔴 ④ 서랍의 검은 바탕이 「눌러서 가는 것」 목록에 **실제로 걸린다**", () => {
  // 바탕은 <details> **안**이라 「바깥 누르기」로는 안 걸린다. 걸리는 길은
  // 「서랍 안의 a·button 을 눌렀다」 하나뿐이다.
  const actions = dismissSource.match(/const PANEL_ACTIONS = "([^"]*)"/);
  assert.ok(actions, "서랍 안에서 접히는 조건을 찾지 못했다");
  const tags = actions[1].split(",").map((one) => one.trim());
  assert.ok(tags.includes("button"), "검은 바탕(button)이 목록에 없다 — 눌러도 안 닫힌다");
  assert.ok(tags.includes("a"), "링크가 목록에 없다 — 화면을 옮겨도 서랍이 남는다");
  assert.match(
    appHeaderSource,
    /<button\s+type="button"\s+aria-label=\{t\.nav\.menuClose\}/,
    "검은 바탕이 button 이 아니거나 type 이 빠졌다"
  );
});

// ── 5. 아무것도 그리지 않는다 ───────────────────────────────────────────────

test("🔴 ⑤ 조각은 아무것도 그리지 않는다 — 마크업이 한 글자도 늘지 않는다", () => {
  assert.match(dismissSource, /export function HeaderMenuDismiss\(\): null \{[\s\S]*?return null;/);
});

test("🔴 ⑤ 그리는 동안에는 화면의 물건을 만지지 않는다 — 서버에서 그려도 안 터진다", () => {
  // node 에는 document 가 아예 없다. useEffect 밖에서 만지면 서버 렌더가 죽는다.
  const body = dismissSource.slice(dismissSource.indexOf("export function HeaderMenuDismiss"));
  const touches = [...body.matchAll(/document/g)].length;
  assert.equal(touches, 2, "document 를 만지는 자리가 useEffect 안 둘이 아니다");
  assert.match(body, /useEffect\(\(\) => watchHeaderMenus\(document/);
});
