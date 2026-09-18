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
   * (아래 `shrink-0` 래퍼 — 그 한 겹이 이 머리말의 선을 지킨다).
   * 목록이 비면 그 조각이 스스로 null 이라 래퍼만 남고 아무것도 안 보인다.
   */
  serviceMenu?: ReactNode;
}) {
  return (
    <header className="no-print border-b border-slate-200 bg-white">
      {/*
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
        <Link href="/" className="flex items-baseline gap-2">
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
