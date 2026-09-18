import { setLanguageAction } from "@/app/actions/auth";
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT, type Lang } from "@/lib/i18n";

/**
 * 언어 전환. 쿠키에만 저장하고 URL 은 바꾸지 않는다.
 * 자바스크립트 없이도 동작하도록 form 으로 만든다.
 *
 * 🔴 폰(<768px)에서는 "한국어"·"日本語" 대신 "한"·"日" 한 글자만 보인다
 * (2026-09-18 — 폭이 모자라 버튼 안에서 "한국 / 어" 로 접히던 것을 고쳤다).
 * 두 칸이 116px → 68px 이 된다. 어느 쪽도 **지우는 것이 아니다**: 긴 이름은
 * sr-only 로 마크업에 그대로 남아 낭독기가 읽고, 768px 부터는 눈에도 되돌아온다.
 */
export function LanguageSwitch({ current }: { current: Lang }) {
  return (
    <form action={setLanguageAction} className="flex items-center gap-1">
      {LANGUAGES.map((lang) => {
        const active = lang === current;
        return (
          <button
            key={lang}
            name="lang"
            value={lang}
            type="submit"
            aria-pressed={active}
            className={
              active
                ? "rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white"
                : "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }
          >
            {/*
              짧은 쪽은 aria-hidden 이다 — 아래 긴 이름이 낭독기용으로 늘 남아
              있어서, 그대로 두면 "한 한국어" 로 두 번 읽힌다.
            */}
            <span className="md:hidden" aria-hidden="true">
              {LANGUAGE_SHORT[lang]}
            </span>
            {/*
              🔴 `sr-only` 이지 `hidden` 이 아니다 — position:absolute 라 폰에서
              자리를 한 픽셀도 먹지 않으면서 마크업에는 남는다. `md:not-sr-only`
              로 768px 부터 평범한 글자로 되돌아오므로, 넓은 화면의 생김새는
              이 변경 전과 완전히 같다.
            */}
            <span className="sr-only md:not-sr-only">{LANGUAGE_LABEL[lang]}</span>
          </button>
        );
      })}
    </form>
  );
}
