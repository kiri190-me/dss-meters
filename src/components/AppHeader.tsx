import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions/auth";
import type { WebUser } from "@/lib/db/schema";
import type { Dictionary, Lang } from "@/lib/i18n";
import { HeaderMenuDismiss } from "./HeaderMenuDismiss";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * 화면으로 가는 링크. **넓은 화면의 오른쪽 묶음과 ☰ 서랍이 이 조각 하나를 함께 쓴다.**
 *
 * 🔴 두 벌로 베껴 적지 않는 까닭: 여기 달린 자격 규칙(ADMIN 만 알림 설정을 본다)이
 *    갈리면 **폰과 컴퓨터가 서로 다른 메뉴를 그린다.** 베낀 쪽은 고칠 때 잊히고,
 *    그 어긋남은 아무 오류도 내지 않는다. 지금 화면 링크가 하나뿐이라고 베껴 두면
 *    둘째가 생기는 날 이미 두 벌이다.
 * 🔴 막는 자리는 여기가 아니다 — `/settings/notify` 화면과 그 서버 액션이 역할을
 *    다시 본다. 이 조각은 **보일지만** 가른다.
 *
 * 생김새만 둘이다:
 *   - `"bar"`   넓은 화면(768px 이상)의 한 줄. 짧은 이름·긴 이름 짝은 그대로 둔다
 *               (까닭은 아래 머리말 주석의 「짧은 이름」 절).
 *   - `"panel"` ☰ 서랍 안에 **세로로** 선 모습. 서랍은 폭이 넉넉해 늘 긴 이름이다.
 */
function ScreenLinks({
  user,
  t,
  variant,
}: {
  user: WebUser;
  t: Dictionary;
  variant: "bar" | "panel";
}) {
  // 알림 설정은 관리자만 쓴다. 열람자에게는 보이지 않는다.
  if (user.role !== "ADMIN") return null;

  if (variant === "bar") {
    return (
      <Link
        href="/settings/notify"
        className="text-sm whitespace-nowrap text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
      >
        {/* 폰에서는 "알림"만. 긴 이름은 아래 sr-only 로 남아 낭독기가 읽는다. */}
        <span className="md:hidden" aria-hidden="true">
          {t.nav.notifySettingsShort}
        </span>
        <span className="sr-only md:not-sr-only">{t.nav.notifySettings}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/settings/notify"
      className="block rounded-md px-2 py-2 text-sm whitespace-nowrap text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    >
      {t.nav.notifySettings}
    </Link>
  );
}

export function AppHeader({
  user,
  lang,
  t,
  portalUrl,
  serviceMenu = null,
  notificationBell = null,
}: {
  user: WebUser;
  lang: Lang;
  t: Dictionary;
  /** 포털의 앱 런처. 다른 사내 시스템으로 건너가는 문이다. */
  portalUrl: string;
  /**
   * 사내 시스템 오가기 목록(@dss/ui 의 ServiceMenuBar). layout 이 서버에서
   * 만들어 내려보내고, 이 머리말이 **시스템 이름 다음**에 그린다.
   *
   * 조각이 아니라 **다 그려진 노드**를 받는 이유: 이 파일이 @dss/ui 도,
   * 목록을 어디서 구하는지도 몰라야 한다. 그리는 자리만 여기가 정한다
   * (아래 `shrink-0` 래퍼 — 그 한 겹이 이 머리말의 선을 지킨다).
   * 목록이 비면 그 조각이 스스로 null 이라 래퍼만 남고 아무것도 안 보인다.
   */
  serviceMenu?: ReactNode;
  /**
   * 알림 종(@dss/ui 의 NotificationBell). 메뉴바와 **같은 방식**으로 받는다 —
   * 다 그려진 노드다. 이 파일은 @dss/ui 도, 알림을 어디서 구하는지도 모른다.
   *
   * layout 이 `<Suspense>` 로 감싼 조각을 내려보내므로, 포털이 느려도 이
   * 머리말은 기다리지 않는다 — 종만 나중에 흘러 들어온다.
   *
   * 🔴 그릴 알림이 없으면 그 조각이 **스스로 null** 이다(@dss/ui 의 판단 —
   * 눌러도 아무것도 없는 단추를 머리말에 남기지 않는다). 그래서 래퍼 <div> 로
   * 감싸지 않고 **flex 항목으로 그대로** 둔다: 감싸면 알림이 없을 때도 빈
   * 항목과 그 앞 여백(gap-3 12px)이 남아 머리말이 예전과 달라진다.
   *
   * 🔴 종을 오른쪽 끝으로 보내는 것은 **이 머리말 쪽**이다(2026-10-22). 아래
   * 오른쪽 묶음의 `ml-auto` 가 줄에 남는 자리를 전부 먹어 그 묶음을 — 그리고
   * 그 마지막 자식인 종을 — 오른쪽 끝에 세운다.
   * 🔵 그 전(2026-09-18~10-22)에는 내려오는 노드가 `ml-auto` 를 달고 왔다. 그때는
   * 이 묶음이 폰에서 `w-full` 이라 묶음 **안**에 남는 자리가 있었기 때문이다.
   * 글자 칸 다섯이 ☰ 서랍으로 들어가면서 그 전제가 사라져 그쪽에서 걷었다
   * (까닭과 되돌리는 법은 components/PortalNotificationBell.tsx 의 주석에).
   */
  notificationBell?: ReactNode;
}) {
  return (
    // ── 🔴 머리말은 굴러도 화면 위에 남는다 (2026-10-22, 옆 시스템과 같은 모양으로) ──
    //
    // 🔴 `position` 이 이 머리말에 **처음** 붙는다 — 바꿔 끼운 것이 아니다. 예전에는
    //    아무 position 도 없었다. 그래도 종(@dss/ui `.dss-bell`)과 시스템 메뉴
    //    (`.dss-menu__dropdown`)의 **펼친 목록이 서는 자리는 한 픽셀도 안 움직인다** —
    //    두 목록을 매다는 상자가 저마다 제 CSS 로 `position: relative` 라
    //    (vendor/dss-ui 의 그 두 파일을 직접 읽고 확인했다) 애초에 이 머리말을
    //    기준으로 삼은 적이 없기 때문이다. 머리말이 새 기준 상자가 되면서 목록이
    //    딸려 가는 일은 없다.
    // 🔵 `sticky` 가 먹는 조건도 확인했다 — 바깥 줄(html.h-full → body.min-h-full →
    //    (internal)/layout.tsx 의 `flex min-h-full flex-col`)에 이것을 막는 overflow 가
    //    한 곳도 없다.
    //
    // 🔴 `z-30` 은 **재 본 값**이다 (2026-10-22, `grep -rn "z-" src/`). 이 저장소의
    //    본문에는 z 가 **한 곳도 없다** — 양수면 무엇이든 본문 위다. 그중 30 을 고른
    //    까닭은 둘이다: 옆 시스템(재고관리)이 같은 값이라 사내 시스템의 머리말이
    //    서로 같은 층으로 읽히고, 본문에 20 대가 생기는 날에도 여유가 있다.
    //    🔴 z 를 주면 머리말이 **쌓임 맥락**을 만든다. 그 뒤로 머리말 **안**의 z 값
    //    (종의 펼친 목록 50 · 시스템 메뉴의 펼친 목록 50 — 둘 다 @dss/ui 의 CSS)은
    //    이 맥락 **안에서만** 겨루고, 바깥과는 이 30 하나로 겨룬다. 그래서 본문에
    //    30 이상을 더하는 날에는 **이 값도 함께 올려야 한다** — 안 올리면 머리말이
    //    덮이는데 오류는 한 줄도 안 난다. 그것을 재는 시험이 app-header.test.ts ⑤ 다.
    //
    // 🔵 **`print:static` 을 적지 않는다 — 본보기와 다른 점이고 일부러다.** 본보기
    //    (재고관리)의 머리말은 종이에도 찍혀서 인쇄할 때 고정을 풀어 줘야 하지만, 이
    //    사이트의 머리말은 `no-print` 라 인쇄에서 **통째로 사라진다**(globals.css 의
    //    @media print). 사라지는 것에 position 을 되돌려 줄 일은 없다.
    // 🔵 위쪽 노치 여백(safe-area 인셋을 패딩에 더하는 것)도 적지 않는다 — 이
    //    저장소는 viewport-fit=cover 를 켜지 않아 그 값이 늘 0 이고, 그 사실이
    //    (internal)/layout.tsx 주석에 이미 적혀 있다. 켜는 날 함께 더한다.
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
      {/*
        🔵 **먼저 읽을 것 (2026-10-22).** 폰에서 이 줄은 이제 **한 줄**이다 —
        ☰ 36 + 16 + 이름 120 + 16 + 메뉴 단추 59 + 16 + 알림 종 40 = **303 ≤ 328**.
        아래 「두 줄」 셈은 글자 칸 다섯(알림 설정·언어 전환·이름·포털·로그아웃)이
        이 줄에 늘어서던 때의 것이고, 그 다섯은 ☰ 서랍으로 들어갔다.
        🔴 `flex-wrap` 은 **그대로 둔다** — 768〜810px 에서 오른쪽 묶음이 통째로
        둘째 줄로 내려가는 길이고, 글꼴이 다른 기기를 위한 안전망이다.

        🔴 `flex-wrap` 은 **그대로 둔다**(2026-09-18, 메뉴바를 들이면서 다시 봤다).

        폰(360px)의 안쪽 폭은 360 − px-4×2 = **328px** 인데, 이름(120) + 메뉴바
        + 오른쪽 묶음(짧은 이름으로 줄인 뒤에도 관리자·일본어 282)이 다 들어갈
        수는 없다. 줄바꿈을 끄면 flex 가 칸을 min-content 밑으로 눌러 **버튼
        안에서 글자를 접는다** — 2026-09-18 사용자 폰 사진이 바로 그 모습이었다
        ("한국 / 어", "통합 로그인으 / 로"). 오른쪽 묶음을 통째로 둘째 줄로
        내려보내는 편이 훨씬 낫다.

        🔴 메뉴바가 **드롭다운 단추 하나**가 된 뒤(@dss/ui, 2026-09-18
        오후)의 폰 줄 나누기는 이렇다 — 아래 래퍼가 `shrink-0` 이라 기준 폭이
        제 내용 폭(폰 59px)이다:

          첫째 줄  이름 120 + gap 16 + 단추 59 = 195  ≤ 328 ✔
          둘째 줄  오른쪽 묶음 246(ja 282)          ≤ 328 ✔

        그래서 폰은 **두 줄**이다 — 메뉴바를 가로 띠로 그리던 때(첫 줄 메뉴
        123, 둘째 줄 오른쪽 묶음)와 **줄 수가 같다.** 남는 자리로 시스템
        이름을 되돌렸다(아래 주석).
      */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {/*
          ☰ — 768px 미만에서만 선다. 🔴 **머리말 맨 왼쪽**이다, 시스템 이름보다도 앞
          (2026-10-22 쓰는 분 기준. 본보기는 옆 시스템인 재고관리이고, 거기 본보기는
          A/S 의 TopBar 다 — 셋 다 ☰ 가 머리말의 첫 자식이다).

          🔴 **좁은 화면에서 머리말이 한 줄이 된다.** 그 전에는 두 줄이었다 —
          첫 줄에 이름과 메뉴 단추, 둘째 줄에 알림 설정·언어 전환·포털·로그아웃이
          알약처럼 늘어섰다. 그 넷이 통째로 이 서랍 안으로 들어가고, 줄에 남는 것은
          ☰ · 이름 · 메뉴 단추 · 알림 종 넷뿐이다(폰 360px 셈은 아래 `flex-wrap` 주석).

          🔴 768px 이상에서는 `md:hidden` 이라 **아예 그려지지 않는다.** 그래서 자리를
          더해도 넓은 화면은 예전과 글자 하나 다르지 않다. 768 이라는 값은 고른 것이
          아니라 **맞춘 것**이다 — @dss/ui 의 메뉴 단추가 이름을 감추는 폭이고
          (service-menu.css 의 미디어 쿼리), 이 머리말이 짧은 이름으로 바꾸는 폭이다.
          한쪽만 옮기면 그 사이 폭에서 모양이 어긋난다(app-header.test.ts 가 셋을 맞댄다).

          🔴 **`<details>`/`<summary>` 다 — 자바스크립트를 쓰지 않는다.** 이 파일에는
          클라이언트 지시문이 없다(**서버 컴포넌트**다 — 그 낱말을 여기 적지 않은 것은
          일부러다. 「서버로 남았는가」를 소스 글자로 세는 시험이 있어서, 주석에 적어
          두면 그 셈이 1 이 되어 사람을 속인다). `useState` 로 여닫으려면 이 머리말을
          통째로 클라이언트로 내려야 하는데, 그 경계가 깨지면 **시험이 다 통과해도
          화면이 안 열리는** 결함이 생기고 `npm run build` 에서만 드러난다.
          여는 일은 브라우저에 맡긴다.

          🔴 `shrink-0` — 이 줄에서 눌려도 되는 것은 글자뿐이다. 없으면 좁은 폭에서
          flex 가 36px 짜리 단추를 깎아 **손가락에 안 잡히는 크기**가 된다.
          🔴 `data-header-menu` 는 모양이 아니라 **표식**이다 — 아래 `<HeaderMenuDismiss />`
          가 「우리 ☰」만 골라 집는 손잡이로 쓴다. 이 칸을 지우거나 이름을 바꾸면 서랍이
          **저절로 안 접히는데 오류도 안 난다.** 이 사이트에는 남의 `<details>` 가 둘
          (시스템 메뉴·알림 종) 돌고 있어 넓게 잡으면 **그 둘이 안 펼쳐진다.**
        */}
        <details className="no-print shrink-0 md:hidden" data-header-menu="">
          <summary
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-slate-700 select-none hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
            aria-label={t.nav.menu}
          >
            {/* 🔴 `list-none`(파이어폭스·크롬)과 웹킷 표식 끄기를 **둘 다** 해야
                <summary> 앞의 ▶ 삼각형이 사라진다. 하나만 끄면 사파리에서 남는다. */}
            <span aria-hidden="true" className="text-lg leading-none">
              ☰
            </span>
          </summary>
          {/* 서랍을 **저절로 접는** 조각. 아무것도 그리지 않는다 — 마크업이 한 글자도
              늘지 않으므로 아래 서랍의 모양과 차례는 그대로다.
              🔵 이 조각이 없어도(스크립트가 아직 안 붙었어도) ☰ 는 눌러서 열리고 다시
                 눌러 접힌다. 더해지는 것은 **접히는 때** 셋뿐 — 까닭은 그 파일 머리말에. */}
          <HeaderMenuDismiss />
          {/*
            서랍 — 왼쪽에서 나온다.

            🔴 `fixed` 는 **화면**에 매달린다 — 머리말에 매달리지 않는다. 위
               <header> 의 `sticky` 는 fixed 의 기준 상자를 만들지 않으므로(그것을
               만드는 것은 transform·filter·contain 같은 것들이고 이 저장소에는 없다)
               머리말 안에 적어도 화면 전체를 덮는다.
            🔴 z 는 **머리말 안에서만** 겨룬다(머리말이 쌓임 맥락이다 — 위 <header>
               주석). 같은 맥락에 알림 종의 펼친 목록과 시스템 메뉴의 펼친 목록이
               각각 50 으로 들어와 있다(@dss/ui 의 CSS, 직접 재 본 값). 서랍은
               화면을 덮는 것이라 둘보다 위여야 해서 60 으로 둔다.
            🔵 `md:hidden`·`no-print` 를 여기 또 적지 않는다 — 바깥 <details> 가 이미
               걸고 있어 넓은 화면과 인쇄에서는 통째로 사라진다.
          */}
          <div className="fixed inset-0 z-[60] flex">
            {/*
              검은 바탕. 🔴 **반드시 `<button>` 이어야 한다** — 모양 때문이 아니라
              **눌러서 닫히게 하려고** 그렇다.

              이 바탕은 `<details>` **안**이다. 그래서 HeaderMenuDismiss 의
              「바깥 누르기」(pointerdown)에는 **안 걸린다** — 안이니까. 걸리는 길은
              다른 쪽이다: 서랍 **안**은 click 으로 듣고, 눌린 것이 거기
              `PANEL_ACTIONS = "a, button"` 에 걸릴 때만 접는다. 이것이 `<button>`
              이면 그대로 접히고, 평범한 `<div>` 면 **눌러도 아무 일이 없는데 오류도
              안 난다.**
              🔴 규칙이 두 파일에 흩어져 있어 한쪽만 바뀌면 조용히 깨진다 — 두 파일을
                 맞대어 보는 시험이 header-menu-dismiss.test.ts 에 있다.
              🔴 `type="button"` 을 빠뜨리지 마라. 빠지면 기본값이 `submit` 이다. 같은
                 서랍 안에 로그아웃 <form> 과 언어 전환 <form> 이 있어, 마크업을 조금만
                 손대면 **바탕을 누를 때마다 로그아웃되는** 자리다.
            */}
            <button
              type="button"
              aria-label={t.nav.menuClose}
              className="absolute inset-0 bg-black/40"
            />
            {/*
              서랍 본체.
              🔵 `overflow-y-auto`(+`min-h-0`) — 가로로 눕힌 폰에서는 메뉴가 화면보다
                 길다. `overscroll-contain` 은 끝까지 민 스크롤이 뒤 페이지로 새는 것을
                 막는다(폰에서 화면이 통째로 튀는 그것).
              🔵 아래쪽 노치 여백(safe-area)은 **일부러 넣지 않았다.** 이 저장소는
                 viewport-fit=cover 를 쓰지 않아 그 값이 늘 0 이고, 「인셋이 한 곳도
                 없다」를 못 박는 시험이 이미 있다(service-menu-bar.test.ts). 켜는 날
                 함께 더한다.
            */}
            <div className="relative z-50 flex min-h-0 w-64 flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-white px-4 pt-3 pb-3">
              <nav aria-label={t.nav.menu} className="flex flex-col gap-0.5">
                <ScreenLinks user={user} t={t} variant="panel" />
              </nav>
              {/*
                빈 칸막이 — 아래 묶음을 **서랍 바닥**에 붙인다.

                🔴 **`mt-auto` 를 쓰지 않은 까닭.** 아래 묶음에 margin-top:auto 를 주면
                   자리가 남을 때는 잘 내려가지만, 메뉴가 **서랍보다 길어지는 순간**
                   (가로로 눕힌 폰 · 글자 크기를 키운 기기 · 메뉴가 더 느는 날) 남는
                   자리가 없어 auto 가 **0 으로 풀린다.** 그러면 지금 보장돼 있는 구분선
                   위 12px 간격(아래 `mt-3`)이 사라져 구분선이 마지막 링크에 바짝
                   달라붙는다 — 간격이 가장 필요한 때에 없어지는데 오류는 한 줄도 안 난다.
                🔵 칸막이는 두 경우가 모두 옳다: 자리가 남으면 `grow` 가 남는 자리를
                   전부 가져가 아래 묶음이 바닥에 붙고, 내용이 길어지면 남는 자리가 없어
                   높이 0 으로 줄어 **칸막이가 없던 때와 픽셀 단위로 같은 모양**이 된다.
                🔴 **빈 div 라고 지우지 마라.** 지우면 아래 묶음이 다시 링크 바로 밑으로
                   올라붙는데 오류는 안 난다.
                🔵 `aria-hidden` — 아무것도 그리지 않으므로 낭독기에 알릴 것이 없다.
                   HeaderMenuDismiss 의 「안쪽을 누르면 접는다」 규칙은 링크·단추만
                   보므로 칸막이는 거기 안 걸린다. 눌러도 아무 일이 없다(맞다).
              */}
              <div aria-hidden="true" className="grow" />
              {/*
                구분선 아래는 넓은 화면에서 오른쪽 끝에 서 있던 것들이다 — **차례도
                그대로**다(언어 전환 → 이름·역할 → 통합 로그인으로 → 로그아웃).
                🔵 서랍은 폭이 넉넉해 짧은 이름을 쓰지 않는다. 다만 언어 전환은 제
                   조각(LanguageSwitch)이 768px 미만에서 "한"·"日" 한 글자를 보이는데,
                   그 둘은 제 언어 이름의 첫 글자라 서랍에서도 바로 알아본다 — 손대지
                   않는다(긴 이름은 거기서도 sr-only 로 남아 낭독기가 읽는다).
              */}
              <div className="mt-3 flex flex-col items-stretch gap-2 border-t border-slate-200 pt-3">
                <LanguageSwitch current={lang} />
                <span className="text-sm whitespace-nowrap text-slate-600">
                  {user.displayName}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {user.role === "ADMIN" ? t.nav.admin : t.nav.viewer}
                  </span>
                </span>
                <a
                  href={portalUrl}
                  className="block rounded-md border border-slate-300 px-2.5 py-1.5 text-center text-xs font-medium whitespace-nowrap text-slate-600 hover:bg-slate-50"
                >
                  {t.nav.portal}
                </a>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-500 hover:bg-slate-200"
                  >
                    {t.nav.logout}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </details>

        {/*
          시스템 이름. 🔴 **폰에서도 보인다**(2026-09-18 오후에 되돌렸다).

          잠깐 `sr-only md:not-sr-only` 로 폰에서 감춰 두었던 적이 있다 —
          메뉴바가 아직 **가로로 늘어선 칸 셋**(123px)이던 때, 그 셋이 다
          보이게 하려고 이름 120px 을 내준 것이었다. 메뉴바가 드롭다운
          **단추 하나**(폰 59px)가 되면서 그 이유가 사라졌다.

          🔴 이 저장소에서는 그것이 특히 나빴다: 목록 화면의 본문 제목이
          `print-only` 라 화면에 없어서, 이름을 감추면 **폰 첫 화면에 시스템
          이름이 글자로 한 톨도 남지 않았다**(어디인지 알 단서가 메뉴 단추의
          이모지뿐).

          🔴 되돌려도 폰에서 줄이 늘지 않는다(360px 기준):
            이름 120 + gap 16 + 단추 59 = 195 ≤ 328  → 첫 줄에 함께 선다
            + gap 16 + 오른쪽 묶음 246 = 457 > 328   → 오른쪽은 둘째 줄
          감췄을 때도 오른쪽 묶음은 둘째 줄이었으므로(메뉴 123 + 16 + 246 =
          385 > 328) **두 줄 그대로**다.

          ⚠️ 폭이 428〜488px 인 큰 폰(ja 는 453〜520px)에서만 한 줄이 두 줄이
          된다 — 감췄을 때는 메뉴 123 + 16 + 246 = 385 가 들어가던 폭이다.
          그보다 흔한 360·390·412px 은 원래 두 줄이라 달라지지 않는다.
        */}
        {/*
          🔴 `whitespace-nowrap` 은 모양이 아니라 **울타리**다 (2026-10-22). 이 칸만
          빠져 있었다 — 오른쪽 묶음의 글자 칸에는 2026-09-18 에 전부 걸었는데(위
          주석과 app-header.test.ts ①), 시스템 이름에는 안 걸었다.

          없으면 이 칸의 min-content 가 **한글 한 자 폭**이 된다(한글은 낱말 가운데서도
          줄이 바뀐다). 자리가 모자라면 flex 가 거기까지 눌러 「계 / 측 / 기 / 관 / 리」
          처럼 **세로로 쪼갠다** — 옆 시스템(재고관리)에서 「재 / 고 / 관 / 리」로 실제로
          일어난 그 증상이고, 거기서도 고친 자리가 이 칸이었다.

          🔵 지금 보이는 모습은 한 픽셀도 안 바뀐다. 첫 줄에 서는 것은 이름(120)과 메뉴
          단추(폰 59)뿐이고 gap 16 을 넣어도 195 라, 폰 속폭 328 안에서 눌릴 일이 없다
          (셈은 위 `flex-wrap` 주석). 이 낱말이 지키는 것은 **나중에 이 줄에 무언가를
          더하는 날**이다 — 그때 글자가 쪼개지면 오류는 안 나고 눈에만 드러난다.
        */}
        <Link href="/" className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            {t.app.title}
          </span>
          <span className="text-xs font-medium text-slate-400">
            {t.app.company}
          </span>
        </Link>

        {/*
          사내 시스템 오가기 목록. 시스템 이름 다음, 오른쪽 글자 묶음 앞 —
          넓은 화면에서 통째로 비어 있던 가운데 자리다.

          🔴 `shrink-0` **한 낱말**이다(2026-09-18 오후, 메뉴바가 드롭다운이
          되면서 `min-w-0 flex-auto md:flex-1` 에서 바꿨다).

          왜 바꿨나. 예전 것은 「**가로로 늘어선 목록**에 남는 자리를 준다」는
          장치였다 — 기준 폭 0(`flex-1`)으로 두고 넘치면 목록이 제 안에서
          가로로 굴러가게(`.dss-menu__list { overflow-x: auto }`) 하는 짝이었다.
          이제 그리는 것은 **단추 하나**이고, 그 단추는 `white-space: nowrap`
          이라 **줄어들지 못한다.** 기준 폭을 0 으로 둔 채 자리가 모자라면
          단추가 제 칸 밖으로 삐져나와 오른쪽 글자와 겹친다(예: 768px 에서
          이 칸 몫은 87px 인데 단추는 130px 이다).

          `shrink-0` 은 기준 폭을 **제 내용 폭**으로 둔다 — 폰 59px, 768px
          이상 130px. 자리가 모자라면 겹치는 대신 오른쪽 묶음이 `flex-wrap`
          으로 **줄을 바꾼다.** 겹치는 것보다 줄이 바뀌는 편이 낫다.

          단추 폭 셈(@dss/ui `.dss-menu__summary`):
            폰(pointer: coarse) 좌우 여백 24 + 아이콘 19 + gap 6 + 삼각형
              8 + 그 왼쪽 여백 2 = **59px** (아이콘이 없는 서비스면 이름 첫
              글자 14 라 54px)
            768px 이상  좌우 여백 20 + 아이콘 19 + gap 6 + 이름 69 + gap 6
              + 삼각형 8 + 2 = **130px**

          🔴 넓은 화면의 생김새는 달라지지 않는다. `flex-1` 일 때는 이 칸이
          남는 자리를 다 먹고 단추가 그 **왼쪽 끝**에 섰는데, `shrink-0` 이면
          남는 자리가 오른쪽 묶음의 `ml-auto` 로 가고 단추는 역시 이름 바로
          다음에 선다 — 그려지는 자리가 같다.

          ⚠️ 768〜810px(태블릿 세로)에서는 이름 120 + 16 + 단추 130 + 16 +
          오른쪽 묶음 497 = 779 가 속폭을 넘어 오른쪽 묶음이 둘째 줄로
          내려간다. 예전에는 한 줄이었지만, 그때 메뉴 칸 몫은 87px 이라
          칸 하나도 온전히 못 보이고 굴려야 했다.
        */}
        <div className="shrink-0">{serviceMenu}</div>

        {/*
          🔵 **먼저 읽을 것 (2026-10-22).** 아래는 **글자 칸 다섯이 폰에서도 이 줄에
          늘어서던 때**의 기록이다. 그 다섯이 ☰ 서랍으로 들어가면서 이 묶음의
          `w-full`·`sm:w-auto`·`sm:justify-end`·`flex-wrap` 은 걷혔다 — 까닭은 바로
          다음 주석에 있다. 아래 셈을 **지우지 않고 남기는** 까닭: ☰ 를 걷는 날
          되돌릴 것이 무엇이고 왜 그랬는지가 여기에만 적혀 있다. 칸마다 걸린
          `whitespace-nowrap` 은 **지금도 그대로 참**이다(서랍 안에서도 쓴다).

          🔴 `flex-wrap` 과 `whitespace-nowrap` 은 **짝**이다(2026-09-18, 사용자
          폰 사진). 이 묶음은 폰에서 안쪽 폭(328px)을 넘는데, 그때 flex 는 칸을
          min-content 까지 눌러 **버튼 안에서 글자를 접었다** — "한국 / 어",
          "통합 로그인으 / 로", "로그아 / 웃". 아래 칸마다 `whitespace-nowrap` 을
          걸어 글자를 온전히 두는 대신, 넘치면 이 묶음이 **줄을 바꾼다**.
          `flex-wrap` 없이 nowrap 만 걸면 페이지가 통째로 가로로 밀린다.

          `sm:justify-end` 는 줄이 바뀌었을 때 둘째 줄도 오른쪽에 붙게 한다(한
          줄에 다 들어가는 넓은 화면에서는 남는 자리가 없어 아무 일도 하지 않는다).

          🔴 폰(<640px)에서만 `w-full` 이고 오른쪽 정렬을 **끈다**(2026-09-18
          사용자 폰 사진 — "둘째 줄이 오른쪽으로 쏠려 왼쪽이 텅 비었다").
          첫 줄은 이름+단추라 왼쪽에서 시작하는데 둘째 줄만 오른쪽 끝에 붙어
          있어 지그재그로 읽혔다. 폰에서 왼쪽 끝을 맞추면 머리말 두 줄과 본문
          (요약·거르개·표)이 **한 세로선**에서 시작한다.

          기준점이 `md`(768)가 아니라 `sm`(640)인 이유: 둘째 줄이 실제로
          생기는 것은 폭 492px 밑이다(이름 123 + 16 + 단추 59 + 16 + 묶음 246
          = 460 > 속폭). 쓰는 폰은 전부 360〜430px 이라 그 안에 들고,
          492〜640px 은 세로 폰도 가로 폰(≥640)도 아닌 빈 구간이다. `md` 로
          두면 그 빈 구간뿐 아니라 **한 줄로 잘 있던 640〜768px 까지** 억지로
          두 줄로 갈라진다.

          폰에서 짧은 이름으로 줄인 덕에 관리자·일본어 최악의 경우도 310px 이라
          한 줄에 들어간다 — 줄바꿈은 글꼴이 다른 기기를 위한 안전망이다.
        */}
        {/*
          🔴 2026-10-22: 이 묶음이 **제 내용 폭만 쓰도록** 바뀌었다
          (`w-full flex-wrap … sm:w-auto sm:justify-end` → `flex items-center`).
          까닭은 ☰ 서랍이다 — 아래 글자 칸들이 768px 미만에서 서랍으로 들어가면서
          이 묶음에 남는 것이 **알림 종 하나**가 됐는데, `w-full` 을 그대로 두면
          종 하나가 **줄을 통째로 차지해** 폰 머리말이 그대로 두 줄로 남는다
          (그리고 알림이 0건이면 높이 0 짜리 빈 줄과 `gap-y-2` 만 남는다).
          제 내용 폭이 되면서 폰 머리말이 ☰·이름·단추·종 **한 줄**이 됐다.

          🔵 그 전의 장치가 무엇이었는지는 남겨 둔다(되돌릴 때 필요하다):
          `w-full` 은 폰에서 이 묶음이 줄을 통째로 쓰고 **왼쪽 끝**에서 시작하게
          하는 것이었고(2026-09-18 사용자 폰 사진 — "둘째 줄이 오른쪽으로 쏠려
          왼쪽이 텅 비었다"), `sm:justify-end`·`sm:w-auto` 는 640px 부터 그것을
          되돌리는 짝이었다. 글자 칸 다섯이 폰에서 여기 늘어서던 때의 것이다.

          🔴 `flex-wrap` 도 여기서는 필요 없어졌다 — 자식이 둘(글자 묶음·종)이고
          글자 묶음은 제 안에서 줄을 바꾼다. 바깥 줄(머리말 전체)의 `flex-wrap` 은
          **그대로**라, 768〜810px 에서 이 묶음이 통째로 둘째 줄로 내려가던 동작은
          달라지지 않는다.

          🔴 넓은 화면(768px 이상)의 생김새는 한 픽셀도 안 바뀐다: 예전에도 이
          묶음은 `sm:w-auto` 라 제 내용 폭이었고 `ml-auto` 로 오른쪽 끝에 섰다.
          종 앞의 여백도 그대로 `gap-3`(12px)이다 — 글자 묶음과 종 사이에 걸린다.
        */}
        <div className="ml-auto flex items-center gap-3">
          {/*
            🔴 글자 묶음 넷(알림 설정·언어 전환·이름·포털·로그아웃)이 **768px 미만에서는
            통째로 ☰ 서랍으로 들어간다**(2026-10-22). 그 전에는 좁은 화면에서도 여기
            알약처럼 늘어서 머리말이 두 줄이었다.

            🔴 **바깥 묶음(바로 위 <div>)의 클래스는 한 글자도 안 바꿨다.** 바꾼 것은
            이 한 겹을 끼운 것뿐이다. 그 까닭은 **알림 종**이다 — 종은 좁은 화면에서도
            접지 않고(알림은 서랍 안에서 기다리면 안 된다) 줄의 맨 오른쪽 끝에 있어야
            펼친 목록이 화면 안에 들어오는데, 그 자리를 만드는 장치가 바깥 묶음의
            `w-full` 과 종이 달고 오는 `ml-auto` **짝**이기 때문이다. 바깥을 건드리면
            그 셈을 처음부터 다시 해야 한다(PortalNotificationBell.tsx 의 폭 셈).
            이 한 겹만 감추면 좁은 화면에서 바깥 묶음에 남는 것은 **종 하나**가 되고,
            그 `ml-auto` 가 줄에 남는 자리를 전부 먹어 종이 오른쪽 끝에 선다 — 종의
            자리를 정하던 셈이 **그대로 맞는다.**

            🔴 기준점이 `md`(768)인 것은 ☰ 의 `md:hidden` 과 **짝**이다. 어긋나면 그
            사이 폭에서 메뉴가 두 벌로 보이거나 한 벌도 안 보인다.

            🔵 아래 칸들의 짧은 이름(`md:hidden` + `sr-only md:not-sr-only`)은 **그대로
            둔다.** 이 묶음이 768px 부터만 보이므로 지금은 짧은 쪽이 눈에 띄지 않지만,
            마크업과 사전에서 지우면 ☰ 를 걷는 날 2026-09-18 의 "한국 / 어"·"통합
            로그인으 / 로" 가 그대로 돌아온다. 지우는 것은 그때 함께 판단할 일이다.
          */}
          <div className="hidden flex-wrap items-center gap-3 md:flex">
            <ScreenLinks user={user} t={t} variant="bar" />

            <LanguageSwitch current={lang} />

            <span className="hidden items-center gap-1.5 text-sm whitespace-nowrap text-slate-600 sm:flex">
              {user.displayName}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {user.role === "ADMIN" ? t.nav.admin : t.nav.viewer}
              </span>
            </span>

            {/*
              포털로 돌아가는 문. 로그아웃과 나란히 두되 생김새를 다르게 한다 —
              둘 다 이 사이트를 떠나지만, 이쪽은 세션을 그대로 두고 다녀오는 것이고
              저쪽은 모든 시스템에서 나가는 것이다. 같아 보이면 잘못 누른다.
            */}
            <a
              href={portalUrl}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-600 hover:bg-slate-50"
            >
              {/*
                폰에서는 "포털"(ja: "ポータル")만 — "통합 로그인으로" 가 110px 이라
                그대로 두면 이 묶음이 한 줄에 들어가지 않는다. 🔴 **없애는 것이
                아니다**: 링크는 그대로 있고 눌러서 갈 수 있으며, 긴 이름이 sr-only
                로 남아 낭독기는 여전히 "통합 로그인으로" 를 읽는다.
              */}
              <span className="md:hidden" aria-hidden="true">
                {t.nav.portalShort}
              </span>
              <span className="sr-only md:not-sr-only">{t.nav.portal}</span>
            </a>

            <form action={logoutAction}>
              {/* 로그아웃은 짧게 줄이지 않는다 — 이 말만은 두 언어 모두 온전해야
                  한다(누르면 모든 시스템에서 나간다). nowrap 으로 접히는 것만 막는다. */}
              <button
                type="submit"
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-500 hover:bg-slate-200"
              >
                {t.nav.logout}
              </button>
            </form>
          </div>

          {/*
            알림 종. 🔴 **줄의 맨 오른쪽 끝**이다 — 펼친 목록은 종에 오른쪽
            끝을 맞춰 왼쪽으로 펼쳐지고(@dss/ui 의 `.dss-bell__list { right: 0 }`)
            폭이 `min(20rem, 100vw - 2rem)`, 폰(360px)에서 320px 이다. 종이
            줄 가운데쯤 앉으면 목록 **왼쪽이 화면 밖으로 잘린다.**

            🔵 **2026-10-22: 끝에 두는 것만으로 된다.** 이 묶음이 제 내용 폭이 되고
            (바로 위 주석) 묶음 자체가 `ml-auto` 로 줄 오른쪽 끝에 서므로, 그 마지막
            자식인 종은 **줄의 오른쪽 끝**이다. 그래서 종이 달고 오던 `ml-auto` 를
            그쪽에서 걷었다 — 묶음 안에 남는 자리가 0 이라 아무 일도 하지 않는다.

            🔵 아래는 **그 전(2026-09-18~10-22)의 셈**이다. 글자 칸 다섯이 폰에서도
            이 줄에 늘어서고 묶음이 `w-full` 이던 때, 「끝에 두는 것」만으로는
            모자랐던 까닭이 여기 적혀 있다 — ☰ 를 걷는 날 그대로 되돌아온다.
            (당시) 이 묶음은 폰(<640px)에서 `w-full` 인데 오른쪽 정렬을 **끄기** 때문에
            (2026-09-18 사용자 폰 사진 — 둘째 줄만 오른쪽으로 쏠려 왼쪽이 텅
            비었다), 끝에 놓아도 종이 글자 덩이를 따라 왼쪽에 붙었다:

              폰(360px, 속폭 328) · 종은 손가락 화면에서 40px 이다
              ─────────────────────────────────────────────────────────
              한국어·열람자   묶음 246 + gap 12 + 종 40 = 298 ≤ 328
                              → 한 줄. 종의 오른쪽 끝이 화면에서 314px 이라
                                목록(320)의 왼쪽 6px 이 잘린다.
              일본어 / 관리자 묶음 282〜310 + 52 = 334〜362 > 328
                              → 묶음이 제 안에서 줄을 바꿔 종이 **둘째 줄 맨
                                왼쪽**에 선다. 그때는 목록이 거의 통째로
                                화면 밖이다.

            그래서 (당시) 내려오는 노드가 `ml-auto` 를 달고 왔다 — 그 한 낱말이 그
            줄에 남는 자리를 전부 먹어 종만 오른쪽 끝으로 보냈다. 넓은 화면
            (≥640px)에서는 그때도 이 묶음이 `w-auto` 라 아무 일도 하지 않았다.

            🔴 래퍼 <div> 로 감싸지 않는다: 알림이 없으면 조각이 스스로 null
            이라 항목 자체가 사라져야 하는데, 감싸면 빈 항목과 그 앞 여백
            (gap-3 12px)이 남는다.

            인쇄에는 나오지 않는다 — 이 머리말이 `no-print` 이고 @dss/ui 의
            CSS 도 `@media print { display: none }` 으로 스스로 감춘다.
          */}
          {notificationBell}
        </div>
      </div>
    </header>
  );
}
