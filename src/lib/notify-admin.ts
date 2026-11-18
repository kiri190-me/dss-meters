/**
 * 알림 설정 화면이 쓰는 조회들.
 *
 * 화면(page.tsx)에서 DB 를 직접 만지지 않는다. 발송 배치도 같은 함수를 써서
 * "화면에서 본 수신자"와 "실제로 받는 사람"이 어긋나지 않게 한다.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  webAuditLogs,
  webNotifications,
  webNotifyRecipients,
  type WebNotification,
  type WebNotifyRecipient,
} from "@/lib/db/schema";

/** 실제로 메일을 받을 사람들. 꺼 둔 사람과 지운 사람은 빠진다. */
export async function listActiveRecipients(): Promise<WebNotifyRecipient[]> {
  return db
    .select()
    .from(webNotifyRecipients)
    .where(
      and(
        eq(webNotifyRecipients.isDeleted, false),
        eq(webNotifyRecipients.isActive, true),
      ),
    )
    .orderBy(asc(webNotifyRecipients.email));
}

/** 설정 화면에 보일 목록. 꺼 둔 사람도 보인다. */
export async function listRecipients(): Promise<WebNotifyRecipient[]> {
  return db
    .select()
    .from(webNotifyRecipients)
    .where(eq(webNotifyRecipients.isDeleted, false))
    .orderBy(asc(webNotifyRecipients.email));
}

/** 최근 발송 기록 */
export async function listNotifications(limit = 12): Promise<WebNotification[]> {
  return db
    .select()
    .from(webNotifications)
    .orderBy(desc(webNotifications.createdAt))
    .limit(limit);
}

/**
 * 그 기한을 보낸 성공 기록. 없으면 null.
 *
 * `alreadySent` 와 같은 줄을 본다. 거기는 **있는지**만 묻고(배치가 매일 도는
 * 자물쇠라 가볍게 둔다), 여기는 **언제 · 몇 명에게** 까지 쓴다 — 수동 발송
 * 단추 옆에 "이 기한은 언제 나갔는지" 를 적어야 사람이 지금 누르면 무슨 일이
 * 벌어지는지 알 수 있다. 🔴 유니크 인덱스 덕에 성공 기록은 기한당 하나뿐이다.
 */
export async function findSentNotification(
  targetYm: string,
): Promise<WebNotification | null> {
  const rows = await db
    .select()
    .from(webNotifications)
    .where(
      and(
        eq(webNotifications.targetYm, targetYm),
        eq(webNotifications.result, "SENT"),
      ),
    )
    .orderBy(desc(webNotifications.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 손으로 다시 보낸 기록.
 *
 * 🔴 수동 발송은 `web_notifications` 에 적지 않는다(까닭은
 * `app/actions/notify.ts` 의 `resendNotifyAction` 주석에 있다). 그래서 그 표만
 * 보여 주면 "다시 보내기를 눌렀는데 기록이 그대로" 로 보이고, 사람이 또 누른다.
 * 발송 기록 화면은 두 자리를 합쳐서 보여 준다.
 */
export type NotifyResend = {
  id: string;
  at: Date;
  /** 누른 사람. 그 시점의 이름이 박혀 있다. */
  actorName: string;
  targetYm: string;
  meterCount: number;
  sent: number;
  failed: number;
  error: string | null;
};

/** jsonb 라 무엇이든 들어 있을 수 있다. 읽는 쪽에서 모양을 가린다. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function listManualResends(limit = 12): Promise<NotifyResend[]> {
  const rows = await db
    .select({
      id: webAuditLogs.id,
      at: webAuditLogs.createdAt,
      actorName: webAuditLogs.actorName,
      changes: webAuditLogs.changes,
    })
    .from(webAuditLogs)
    .where(eq(webAuditLogs.action, "NOTIFY_RESEND"))
    .orderBy(desc(webAuditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const changes = asRecord(row.changes);
    return {
      id: row.id,
      at: row.at,
      actorName: row.actorName,
      targetYm: typeof changes.targetYm === "string" ? changes.targetYm : "",
      meterCount: asCount(changes.meterCount),
      sent: asCount(changes.sent),
      failed: asCount(changes.failed),
      error: typeof changes.error === "string" ? changes.error : null,
    };
  });
}

/** 그 기한을 이미 성공적으로 보냈는지. 배치가 두 번 도는 것을 막는다. */
export async function alreadySent(targetYm: string): Promise<boolean> {
  const rows = await db
    .select({ id: webNotifications.id })
    .from(webNotifications)
    .where(
      and(
        eq(webNotifications.targetYm, targetYm),
        eq(webNotifications.result, "SENT"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
