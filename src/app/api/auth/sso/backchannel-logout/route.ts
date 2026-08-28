/**
 * 포털이 "이 사람 세션 끊어라" 라고 알려 오는 곳
 * (OIDC Back-Channel Logout 1.0).
 *
 * 한 곳에서 나가면 어디서든 나가야 한다. 포털에서 로그아웃했는데 이 화면이
 * 계속 열려 있으면, 공용 PC 에서는 그것이 곧 로그아웃이 안 된 것이다.
 *
 * ⚠️ 이 창구는 인증 없이 누구나 두드릴 수 있다. 서명 검증(verifyLogoutToken)이
 * 이 파일의 전부다 — 건너뛰면 아무나 아무 사람이나 로그아웃시킬 수 있는
 * 창구가 된다. 일하는 사람을 계속 튕겨내는 것만으로도 충분히 성가신 공격이다.
 */
import { verifyLogoutToken } from "@/lib/auth/oidc";
import { revokeSessionsForSubject } from "@/lib/auth/session";

/**
 * 규격이 요구하는 응답 헤더. 이 응답이 캐시되면 다음 통보가 서버에 닿지 않고
 * 캐시로 처리될 수 있다.
 */
const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let token: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("logout_token");
    if (typeof value === "string") token = value;
  } catch {
    // 폼이 아니면 규격을 따르지 않는 요청이다.
  }

  if (!token) {
    return Response.json(
      { error: "invalid_request" },
      { status: 400, headers: NO_STORE },
    );
  }

  const subject = await verifyLogoutToken(token);
  if (!subject) {
    return Response.json(
      { error: "invalid_request" },
      { status: 400, headers: NO_STORE },
    );
  }

  // sid 가 아니라 sub 단위로 끊는다. 공용 PC 에서 나간 사람에게는 그편이
  // 기대에 맞고, 정지된 사람에게는 반드시 그래야 한다.
  const revoked = await revokeSessionsForSubject(subject);

  if (revoked > 0) {
    console.info(`[sso] 세션 ${revoked}건을 끊었습니다: ${subject}`);
  } else {
    // 이 사이트에 아직 들어온 적 없는 사람일 수 있다 — 오류가 아니다.
    // 규격도 이 경우 성공으로 답하라고 한다(끊을 것이 없는 것도 끊긴 것이다).
    console.info(`[sso] 끊을 세션이 없습니다: ${subject}`);
  }

  return new Response(null, { status: 204, headers: NO_STORE });
}
