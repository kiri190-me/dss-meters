"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { endSessionUrl } from "@/lib/auth/oidc";
import { clearServiceMenuCookie } from "@/lib/auth/service-menu-cookie";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { LANG_COOKIE, LANGUAGES, type Lang } from "@/lib/i18n";

/** 화면 언어를 바꾼다. */
export async function setLanguageAction(formData: FormData): Promise<void> {
  const value = String(formData.get("lang") ?? "");
  const lang: Lang = (LANGUAGES as readonly string[]).includes(value)
    ? (value as Lang)
    : "ko";

  const store = await cookies();
  store.set(LANG_COOKIE, lang, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

/**
 * 로그아웃.
 *
 * 이 사이트의 세션을 끊은 뒤 **포털의 로그아웃까지** 다녀온다. 여기 쿠키만
 * 지우면 포털 세션은 그대로라, 로그인 버튼을 한 번 누르는 것만으로 누구인지
 * 다시 묻지도 않고 그대로 들어온다. 자세한 근거는 lib/auth/oidc.ts 의
 * endSessionUrl 주석에 있다.
 *
 * 포털도 백채널 로그아웃으로 이 사이트에 통보하지만, 그 통보를 기다리지
 * 않는다 — 누른 사람의 세션은 지금 끊겨 있어야 한다.
 */
export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await writeAudit({
      actor: user,
      action: "LOGOUT",
      summary: `${user.displayName} 로그아웃`,
    });
  }
  await destroySession();
  // 🔴 서비스 메뉴바 목록도 같이 지운다. 남겨 두면 로그아웃한 사람의
  // 브라우저에 「이 사람이 어떤 시스템을 쓰는지」가 그대로 남는다 — 공용 PC
  // 에서는 그것만으로도 알려 줄 이유가 없는 정보다.
  await clearServiceMenuCookie();
  redirect(endSessionUrl());
}
