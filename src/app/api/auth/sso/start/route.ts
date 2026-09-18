/**
 * 로그인 왕복의 시작. 포털(dss-auth)로 사람을 보낸다.
 *
 *   GET /api/auth/sso/start?returnTo=/meters/xxxx
 *
 * 여기서 만든 state·nonce·code_verifier 를 서명한 쿠키에 담아 두었다가
 * 돌아왔을 때 대조한다. 무엇이 무엇을 막는지는 lib/auth/oidc.ts 에 적혀 있다.
 */
import { cookies } from "next/headers";

import { safeReturnTo } from "@/lib/auth/guards";
import {
  beginLogin,
  sealTransaction,
  SSO_TX_COOKIE,
  SSO_TX_COOKIE_PATH,
  SSO_TX_MAX_AGE_SECONDS,
} from "@/lib/auth/oidc";
import { clearServiceMenuCookie } from "@/lib/auth/service-menu-cookie";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const returnTo = safeReturnTo(
    new URL(request.url).searchParams.get("returnTo"),
  );

  // 이미 들어와 있는 사람을 포털까지 다녀오게 할 이유가 없다.
  if (await getSessionUser()) {
    return new Response(null, { status: 303, headers: { Location: returnTo } });
  }

  // 🔴 여기부터는 **누구인지 모르는 사람**의 로그인이 시작된다. 앞사람이
  // 남긴 서비스 메뉴바 목록을 먼저 지운다 — 남겨 두면 공용 PC 에서 남의
  // 시스템 목록이 뒷사람 화면 위에 뜬다. 세션이 백채널 로그아웃이나 만료로
  // 끊겨도 이 쿠키는 브라우저에 그대로 남아 있어서, 지울 자리가 여기다.
  // (돌아온 뒤에는 콜백이 그 사람 것으로 다시 굽는다)
  await clearServiceMenuCookie();

  const { authorizeUrl, transaction } = beginLogin(returnTo);

  (await cookies()).set(SSO_TX_COOKIE, sealTransaction(transaction), {
    httpOnly: true,
    sameSite: "lax",
    // 사내망 HTTP 단계에서 켜면 쿠키가 저장되지 않아 로그인이 조용히 실패한다.
    secure: env.sessionCookieSecure,
    path: SSO_TX_COOKIE_PATH,
    maxAge: SSO_TX_MAX_AGE_SECONDS,
  });

  return new Response(null, {
    status: 303,
    headers: { Location: authorizeUrl, "cache-control": "no-store" },
  });
}
