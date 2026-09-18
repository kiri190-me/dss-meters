import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions/auth";
import type { WebUser } from "@/lib/db/schema";
import type { Dictionary, Lang } from "@/lib/i18n";
import { LanguageSwitch } from "./LanguageSwitch";

export function AppHeader({
  user,
  lang,
  t,
  portalUrl,
  serviceMenu = null,
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
   * (아래 `min-w-0 flex-1` 래퍼 — 그 한 겹이 이 머리말의 선을 지킨다).
   * 목록이 비면 그 조각이 스스로 null 이라 래퍼만 남고 아무것도 안 보인다.
   */
  serviceMenu?: ReactNode;
}) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      {/*
        🔴 `flex-wrap` 은 **그대로 둔다**(2026-09-18, 메뉴바를 들이면서 다시 봤다).

        폰(360px)의 안쪽 폭은 360 − px-4×2 = **328px** 인데, 이름(123) + 메뉴바
        + 오른쪽 묶음(짧은 이름으로 줄인 뒤에도 관리자·일본어 278)이 다 들어갈
        수는 없다. 줄바꿈을 끄면 flex 가 칸을 min-content 밑으로 눌러 **버튼
        안에서 글자를 접는다** — 2026-09-18 사용자 폰 사진이 바로 그 모습이었다
        ("한국 / 어", "통합 로그인으 / 로"). 오른쪽 묶음을 통째로 둘째 줄로
        내려보내는 편이 훨씬 낫다.

        🔴 그런데 **메뉴바는 그 둘째 줄로 밀려나지 않는다.** 아래 래퍼가
        `flex-1`(= flex: 1 1 0%) 이라 줄 나누기에 쓰이는 기준 폭이 **0** 이고,
        `min-w-0` 이 그 0 을 실제로 0 으로 만든다. 기준 폭이 0 인 항목은 어느
        줄에서도 "넘친다"고 판정되지 않으므로 늘 앞 항목(시스템 이름)과 같은
        줄에 남고, 다른 항목이 접히는 자리도 **한 픽셀도 바꾸지 않는다** —
        줄바꿈 모양은 메뉴바가 들어오기 전과 완전히 같다.
      */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {/*
          시스템 이름. 🔴 폰(<768px)에서는 **눈에서만** 감춘다(2026-09-18 사용자
          지시 — 폰 사진을 보고 "계측기 관리 문구를 지워 달라").

          🔴 `sr-only` 이지 `hidden` 이 **아니다** — 마크업에 그대로 남아 화면
          낭독기는 여전히 "계측기 관리 DSS" 를 읽고, 홈으로 가는 이 링크도
          살아 있다. display:none 으로 지우면 폰에서 이 머리말에 시스템을
          알리는 글자가 한 톨도 없게 된다.

          `sr-only` 는 position:absolute 라 **flex 항목에서 빠진다** — 폭 123px
          뿐 아니라 뒤따르던 gap-x-4 16px 까지 함께 사라져 그 자리가 전부
          메뉴바로 간다. 기준점은 메뉴바가 이름을 감추는 폭과 **같은 768px**
          (`md`)이다.

          🔴 다만 이것만으로 머리말이 한 줄이 되지는 않는다: 메뉴 123 + gap 16
          + 오른쪽 묶음 246(ja 278)= 385px 이라 폰 안쪽 폭 328px 을 넘는다.
          아래 메뉴 칸의 `flex-auto` 주석 참조.
        */}
        <Link
          href="/"
          className="flex items-baseline gap-2 sr-only md:not-sr-only"
        >
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

          🔴 `min-w-0 flex-1` 두 낱말이 이 줄의 선을 지킨다: `flex-1` 은 기준
          폭 0 + 남는 자리 다 갖기라, 이름·언어전환·포털·로그아웃이 제 폭을
          먼저 가져간 **뒤 남은 만큼만** 차지한다. `min-w-0` 은 목록이 길어도
          이 칸이 제 내용 폭까지 부풀지 못하게 막는다 — 그 둘이 없으면 서비스가
          늘어날 때 오른쪽 로그아웃부터 화면 밖으로 밀린다. 목록은 넘치면
          **자기 안에서** 가로로 굴러간다(@dss/ui 의 `.dss-menu__list`).

          🔴 폰에서만 `flex-auto`(= flex: 1 1 **auto**)인 이유. 이름을 감춘 뒤
          기준 폭이 0 인 채로 두면 메뉴와 오른쪽 묶음이 **한 줄에 같이 놓이고**,
          메뉴 몫이 328 − 246 − 16 = 66px(ja 는 34px)밖에 안 되어 아이콘 셋 중
          하나 반만 보인다 — 「지금 여기」 밑줄이 달린 칸까지 잘린다. `flex-auto`
          는 기준 폭을 **제 내용 폭(123px)** 으로 두므로 123 + 16 + 246 = 385 >
          328 이 되어 오른쪽 묶음이 둘째 줄로 내려가고, 메뉴는 첫 줄을 온전히
          쓴다. 세 칸이 다 보이고 굴릴 필요도 없다.

          폰 메뉴 폭 셈: 아이콘만 보이므로 🔧 19 + 좌우 여백 24 = 43, 아이콘
          없는 칸은 이름 첫 글자 14 + 24 = 38, 칸 사이 2 → 셋이 **123px**.

          768px 부터는 `md:flex-1`(= flex: 1 1 **0%**)로 되돌아간다 — 이름이
          눈에 돌아오고 한 줄에 다 들어가는 폭이라, 이 변경 전과 똑같이 그려진다.
        */}
        <div className="min-w-0 flex-auto md:flex-1">{serviceMenu}</div>

        {/*
          🔴 `flex-wrap` 과 `whitespace-nowrap` 은 **짝**이다(2026-09-18, 사용자
          폰 사진). 이 묶음은 폰에서 안쪽 폭(328px)을 넘는데, 그때 flex 는 칸을
          min-content 까지 눌러 **버튼 안에서 글자를 접었다** — "한국 / 어",
          "통합 로그인으 / 로", "로그아 / 웃". 아래 칸마다 `whitespace-nowrap` 을
          걸어 글자를 온전히 두는 대신, 넘치면 이 묶음이 **줄을 바꾼다**.
          `flex-wrap` 없이 nowrap 만 걸면 페이지가 통째로 가로로 밀린다.

          `justify-end` 는 줄이 바뀌었을 때 둘째 줄도 오른쪽에 붙게 한다(한 줄에
          다 들어가는 넓은 화면에서는 남는 자리가 없어 아무 일도 하지 않는다).

          폰에서 짧은 이름으로 줄인 덕에 관리자·일본어 최악의 경우도 310px 이라
          실제로는 한 줄에 들어간다 — 줄바꿈은 글꼴이 다른 기기를 위한 안전망이다.
        */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {/* 알림 설정은 관리자만 쓴다. 열람자에게는 보이지 않는다. */}
          {user.role === "ADMIN" && (
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
          )}

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
      </div>
    </header>
  );
}
