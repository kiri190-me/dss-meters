import { redirect } from "next/navigation";

import { LanguageSwitch } from "@/components/LanguageSwitch";
import { safeReturnTo } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { getDictionary, type Dictionary } from "@/lib/i18n";

/**
 * 로그인 화면.
 *
 * 이 사이트는 아이디도 비밀번호도 받지 않는다. 버튼 하나로 포털(dss-auth)에
 * 넘기고, 포털이 확인해 준 결과만 받는다. 자체 로그인을 만들지 않는 것이
 * 이 프로젝트의 전제다.
 */

/** 콜백이 /login?error=... 로 실어 보내는 거절 사유. 사유마다 할 일이 다르다. */
function errorMessage(code: string | undefined, t: Dictionary): string | null {
  switch (code) {
    case undefined:
      return null;
    case "expired":
    case "state":
      return t.login.errorExpired;
    case "unknown_role":
      return t.login.errorUnknownRole;
    case "inactive":
      return t.login.errorInactive;
    case "deleted":
      return t.login.errorDeleted;
    default:
      return t.login.errorGeneric;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { lang, t } = await getDictionary();

  // 이미 로그인되어 있으면 목록으로 보낸다.
  if (await getSessionUser()) redirect("/");

  const returnTo = safeReturnTo(
    typeof sp.returnTo === "string" ? sp.returnTo : undefined,
  );
  const error = errorMessage(
    typeof sp.error === "string" ? sp.error : undefined,
    t,
  );

  const startUrl =
    returnTo === "/"
      ? "/api/auth/sso/start"
      : `/api/auth/sso/start?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            {t.login.title}
          </h1>
          <LanguageSwitch current={lang} />
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white px-5 py-6">
          <p className="text-sm text-slate-600">{t.login.intro}</p>

          <a
            href={startUrl}
            className="block w-full rounded-md bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-700"
          >
            {t.login.button}
          </a>

          <p className="text-xs text-slate-400">{t.login.hint}</p>
        </div>
      </div>
    </div>
  );
}
