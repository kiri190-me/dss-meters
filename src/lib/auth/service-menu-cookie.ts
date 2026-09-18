/**
 * 머리말 **안**의 서비스 메뉴바가 그릴 목록을 나르는 **별도 서명 쿠키**.
 *
 * ── 왜 세션에 싣지 않나 ──────────────────────────────────────────────────
 * 이 사이트의 세션은 서버 저장형이다(session.ts — 쿠키에는 랜덤 토큰만 있고
 * 실체는 DB 행이다). 거기에 목록을 실으려면 세션 테이블에 칸을 하나 늘려야
 * 하는데, 마이그레이션을 부를 만한 값이 아니다. 이 목록은 인가 판정에 쓰지
 * 않는 **그리기용 값**이고, 포털이 로그인 때 알려 준 것을 다음 로그인까지
 * 들고 있기만 하면 된다. 그래서 브라우저에 맡기고 서명으로 지킨다.
 *
 * ── 왜 서명하나 ──────────────────────────────────────────────────────────
 * 안 하면 사용자가 자기 브라우저에서 값을 바꿔 가짜 링크를 띄울 수 있다.
 * 자기만 속는 일이지만(이 값으로 열리는 권한이 없다) 막는 값이 몇 줄이라
 * 막는 편이 낫다. 서명 방식과 비밀값은 로그인 왕복 쿠키와 같은 것을 쓰고
 * (oidc.ts 의 sealSigned · openSigned, SSO_TX_SECRET), 대신 **용도 표시를
 * 서명에 함께 넣어** 두 쿠키의 값을 서로 바꿔치기할 수 없게 한다.
 *
 * ── 권한을 판정하지 않는다 ───────────────────────────────────────────────
 * 이 목록은 포털(dss-auth)이 ID 토큰의 `dss_services` 클레임으로 알려 준
 * 「이 사람이 들어갈 수 있는 시스템」이다. 여기서는 그것을 **그대로** 나를
 * 뿐, 무엇을 더하거나 빼지 않는다(@dss/ui 의 normalizeServiceMenu 도 그릴
 * 수 없는 칸만 버린다). 판정이 두 벌이 되면 포털 타일과 메뉴바가 서로 다른
 * 말을 하게 된다.
 */
import { cookies } from "next/headers";

import { normalizeServiceMenu, type ServiceMenuEntry } from "@dss/ui";

import { env } from "@/lib/env";
import { openSigned, sealSigned } from "./oidc";

/**
 * 이 사이트 고유 쿠키 이름.
 *
 * 🔴 `meters_` 를 붙이는 이유는 meters_session · meters_sso_tx 와 같다:
 * 쿠키는 **포트를 가리지 않는다.** 개발 PC 에서도 NAS 에서도 포털·A/S·계측기가
 * 같은 호스트의 다른 포트로 뜨므로, 이름이 겹치면 한쪽 로그인이 다른 쪽 쿠키를
 * 덮어쓴다. A/S 가 굽는 것은 dss_service_menu 이고, 그쪽은 비밀값도 다르다.
 */
export const SERVICE_MENU_COOKIE_NAME = "meters_service_menu";

/**
 * 서명에 함께 들어가는 용도 표시. 왕복 쿠키(meters_sso_tx)와 비밀값을 같이
 * 쓰므로, 이 표시가 두 쿠키를 서로 바꿔 넣지 못하게 막는다.
 */
const SERVICE_MENU_PURPOSE = "service-menu";

type ServiceMenuPayload = {
  services: ServiceMenuEntry[];
  issuedAt: number;
  expiresAt: number;
};

/**
 * 쿠키 수명 = 세션 수명. 둘이 어긋나면 세션은 살아 있는데 띠만 사라지거나
 * 그 반대가 된다. (env.sessionHours 는 쓰는 시점에 읽는 값이다)
 */
export function serviceMenuMaxAgeSeconds(): number {
  return Math.floor(env.sessionHours * 60 * 60);
}

/** 세션 쿠키와 같은 조건으로 굽는다 — 수명만 부르는 쪽이 정한다. */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // 사내망 HTTP 단계에서 켜면 쿠키가 저장되지 않는다(session.ts 와 같은 값).
    secure: env.sessionCookieSecure,
    path: "/",
    maxAge,
  };
}

/**
 * ID 토큰에서 꺼낸 `dss_services` 클레임을 쿠키에 담을 토큰으로 만든다.
 *
 * 🔴 **그릴 것이 없으면 null 이다 — 쿠키를 굽지 않는다.** 포털의 그 기능은
 * 아직 배포되지 않았으므로 지금 로그인하면 클레임이 아예 없을 수 있고, 그때
 * 화면은 예전과 한 픽셀도 같아야 한다(띠도, 빈 띠도 그리지 않는다). 클레임이
 * 없는 것과 값이 이상한 것을 가르지 않는 이유도 같다 — 어느 쪽이든 그릴 수
 * 있는 칸이 없으면 띠는 없는 것이 맞다.
 */
export function createServiceMenuToken(claim: unknown): string | null {
  const services = normalizeServiceMenu(claim);
  if (services.length === 0) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: ServiceMenuPayload = {
    services,
    issuedAt,
    expiresAt: issuedAt + serviceMenuMaxAgeSeconds(),
  };
  return sealSigned(SERVICE_MENU_PURPOSE, payload);
}

/**
 * 위조 · 변조 · 만료된 토큰은 모두 **빈 목록**이다(예외를 던지지 않는다).
 *
 * 메뉴바는 곁다리인데 여기서 터지면 본문까지 못 보게 된다. 서명이 맞아도 안에
 * 든 값은 다시 거른다 — 옛 토큰이거나 포털이 먼저 바뀐 경우가 있다.
 */
export function parseServiceMenuToken(token: string): ServiceMenuEntry[] {
  const decoded = openSigned(SERVICE_MENU_PURPOSE, token);
  if (typeof decoded !== "object" || decoded === null) return [];

  const candidate = decoded as Record<string, unknown>;
  // 쿠키의 Max-Age 는 브라우저의 호의일 뿐이라 값으로도 확인한다
  // (oidc.ts 의 왕복 쿠키와 같은 이유).
  if (typeof candidate.expiresAt !== "number") return [];
  if (candidate.expiresAt <= Math.floor(Date.now() / 1000)) return [];

  return normalizeServiceMenu(candidate.services);
}

/** 쿠키가 없거나 못 믿을 것이면 빈 목록 — 그때 띠는 그려지지 않는다. */
export async function readServiceMenu(): Promise<ServiceMenuEntry[]> {
  const token = (await cookies()).get(SERVICE_MENU_COOKIE_NAME)?.value;
  if (!token) return [];
  return parseServiceMenuToken(token);
}

/**
 * 로그인이 끝났을 때 목록을 굽는다.
 *
 * 그릴 것이 없으면 굽지 않고 **남아 있던 것을 지운다.** 공용 PC 에서 앞사람의
 * 목록이 뒷사람 화면에 남지 않게 하기 위한 것이다 — 로그인 자체는 이 함수가
 * 있으나 없으나 똑같이 끝난다.
 */
export async function writeServiceMenuCookie(claim: unknown): Promise<void> {
  const token = createServiceMenuToken(claim);
  const store = await cookies();
  if (token === null) {
    store.set(SERVICE_MENU_COOKIE_NAME, "", cookieOptions(0));
    return;
  }
  store.set(SERVICE_MENU_COOKIE_NAME, token, cookieOptions(serviceMenuMaxAgeSeconds()));
}

/**
 * 🔴 로그인 통로와 로그아웃에서 부른다.
 *
 * 안 지우면 공용 PC 에서 앞사람이 남긴 쿠키가 뒷사람 화면에 **남의 시스템
 * 목록**으로 뜬다. 세션이 끊겨도(백채널 로그아웃·만료) 이 쿠키는 브라우저에
 * 그대로 남으므로, 다음 사람이 로그인을 시작하는 순간 먼저 지워야 한다.
 */
export async function clearServiceMenuCookie(): Promise<void> {
  (await cookies()).set(SERVICE_MENU_COOKIE_NAME, "", cookieOptions(0));
}
