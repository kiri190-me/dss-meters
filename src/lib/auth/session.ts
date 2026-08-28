/**
 * 이 사이트의 세션을 읽고 쓰는 유일한 파일.
 *
 * 화면·API 곳곳에서 쿠키를 직접 읽지 않는다. 반드시 여기를 거친다.
 *
 * 서버 저장형이다 — 쿠키에는 랜덤 토큰 원문만 담고 DB 에는 그 sha256 만 둔다.
 * 이렇게 해야 퇴사자·문제 계정을 즉시 끊을 수 있다.
 */
import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { webSessions, webUsers, type WebUser } from "@/lib/db/schema";
import { env } from "@/lib/env";

/** 이 사이트 고유 쿠키 이름. 포털의 dss_sso 와 절대 겹치지 않게 한다. */
export const SESSION_COOKIE = "meters_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.sessionHours * 60 * 60 * 1000);

  await db.insert(webSessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 사내망 HTTP 단계에서 켜면 쿠키가 저장되지 않아 로그인이 조용히 실패한다.
    secure: env.sessionCookieSecure,
    expires: expiresAt,
  });
}

/** 현재 요청의 로그인 사용자. 없으면 null. */
export async function getSessionUser(): Promise<WebUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: webUsers })
    .from(webSessions)
    .innerJoin(webUsers, eq(webUsers.id, webSessions.userId))
    .where(
      and(
        eq(webSessions.tokenHash, hashToken(token)),
        gt(webSessions.expiresAt, new Date()),
        isNull(webSessions.revokedAt),
        eq(webUsers.isActive, true),
        eq(webUsers.isDeleted, false),
      ),
    )
    .limit(1);

  return rows[0]?.user ?? null;
}

/**
 * 그 사람의 이 사이트 세션을 전부 끊는다.
 *
 * 포털이 백채널 로그아웃으로 "이 사람 끊어라" 라고 알려올 때 쓴다. 세션을
 * 서버 저장형으로 만든 이유가 바로 이 즉시 회수다 — 서명된 토큰이었다면
 * 발급된 뒤에는 스스로 유효해서, 포털이 자기 세션을 폐기해도 여기 쿠키는
 * 그대로 살아 있다.
 *
 * 특정 세션 하나가 아니라 그 사람 전부를 끊는다. 공용 PC 에서 로그아웃한
 * 사람에게는 그편이 기대에 맞고, 정지된 사람에게는 반드시 그래야 한다.
 */
export async function revokeSessionsForSubject(authSub: string): Promise<number> {
  const rows = await db
    .update(webSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        isNull(webSessions.revokedAt),
        inArray(
          webSessions.userId,
          db.select({ id: webUsers.id }).from(webUsers).where(eq(webUsers.authSub, authSub)),
        ),
      ),
    )
    .returning({ id: webSessions.id });

  return rows.length;
}

/** 이 사이트의 세션만 끊는다. (포털 세션은 그대로) */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db
      .update(webSessions)
      .set({ revokedAt: new Date() })
      .where(eq(webSessions.tokenHash, hashToken(token)));
  }

  store.delete(SESSION_COOKIE);
}
