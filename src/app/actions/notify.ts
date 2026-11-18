"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { webNotifyRecipients, webNotifyTemplates } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { createTransport } from "@/lib/mail/transport";
import { listNotifyTargets, nextNotifyYm } from "@/lib/notify";
import { listActiveRecipients } from "@/lib/notify-admin";
import { deliverNotifyMails, renderNotifyBodies } from "@/lib/notify-send";

export type NotifyFormState = { error?: string; ok?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * id 를 UUID 로 확인한 뒤에 DB 로 보낸다.
 * 빈 값이나 엉뚱한 값을 그대로 넘기면 Postgres 가 uuid 변환에서 터져
 * 화면에 500 이 뜬다. 없는 것은 없는 것으로 다루는 편이 맞다.
 */
function uuid(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return UUID_PATTERN.test(value) ? value : null;
}

function lang(formData: FormData, key: string): Lang {
  const value = text(formData, key);
  return (LANGUAGES as readonly string[]).includes(value) ? (value as Lang) : "ko";
}

/* ------------------------------------------------------------------ */
/* 수신자                                                               */
/* ------------------------------------------------------------------ */

export async function addRecipientAction(
  _prev: NotifyFormState,
  formData: FormData,
): Promise<NotifyFormState> {
  const admin = await requireAdmin();

  const email = text(formData, "email").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "메일 주소 형식이 아닙니다." };
  }

  // 지운 적 있는 주소는 되살린다. 유니크 인덱스가 지운 것은 세지 않기 때문에
  // 그냥 넣으면 같은 주소가 두 줄이 된다.
  const existing = (
    await db
      .select()
      .from(webNotifyRecipients)
      .where(eq(webNotifyRecipients.email, email))
      .limit(1)
  )[0];

  const values = {
    email,
    name: text(formData, "name") || null,
    lang: lang(formData, "lang"),
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    updatedAt: new Date(),
  };

  if (existing && !existing.isDeleted) {
    return { error: "이미 등록된 주소입니다." };
  }

  const [saved] = existing
    ? await db
        .update(webNotifyRecipients)
        .set(values)
        .where(eq(webNotifyRecipients.id, existing.id))
        .returning()
    : await db.insert(webNotifyRecipients).values(values).returning();

  await writeAudit({
    actor: admin,
    action: "NOTIFY_RECIPIENT_ADD",
    entityType: "web_notify_recipients",
    entityId: saved.id,
    summary: `알림 수신자 추가: ${email}`,
    changes: { lang: values.lang },
  });

  revalidatePath("/settings/notify");
  return { ok: `${email} 을(를) 추가했습니다.` };
}

/** 잠시 끄고 켜기. 지우지 않는다. */
export async function toggleRecipientAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = uuid(formData, "id");
  if (!id) redirect("/settings/notify");

  const target = (
    await db
      .select()
      .from(webNotifyRecipients)
      .where(
        and(
          eq(webNotifyRecipients.id, id),
          eq(webNotifyRecipients.isDeleted, false),
        ),
      )
      .limit(1)
  )[0];
  if (!target) redirect("/settings/notify");

  const next = !target.isActive;
  await db
    .update(webNotifyRecipients)
    .set({ isActive: next, updatedAt: new Date() })
    .where(eq(webNotifyRecipients.id, id));

  await writeAudit({
    actor: admin,
    action: "NOTIFY_RECIPIENT_UPDATE",
    entityType: "web_notify_recipients",
    entityId: id,
    summary: `알림 수신자 ${next ? "켜기" : "끄기"}: ${target.email}`,
  });

  revalidatePath("/settings/notify");
}

export async function deleteRecipientAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = uuid(formData, "id");
  if (!id) redirect("/settings/notify");

  const target = (
    await db
      .select()
      .from(webNotifyRecipients)
      .where(eq(webNotifyRecipients.id, id))
      .limit(1)
  )[0];
  if (!target || target.isDeleted) redirect("/settings/notify");

  await db
    .update(webNotifyRecipients)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(webNotifyRecipients.id, id));

  await writeAudit({
    actor: admin,
    action: "NOTIFY_RECIPIENT_DELETE",
    entityType: "web_notify_recipients",
    entityId: id,
    summary: `알림 수신자 삭제: ${target.email}`,
  });

  revalidatePath("/settings/notify");
}

/* ------------------------------------------------------------------ */
/* 메일 본문                                                            */
/* ------------------------------------------------------------------ */

export async function saveTemplateAction(
  _prev: NotifyFormState,
  formData: FormData,
): Promise<NotifyFormState> {
  const admin = await requireAdmin();

  const target = lang(formData, "lang");
  const subject = text(formData, "subject");
  const lead = text(formData, "lead");
  const footer = text(formData, "footer");

  if (!subject) return { error: "메일 제목을 입력하세요." };
  if (!lead) return { error: "본문 앞말을 입력하세요." };

  const existing = (
    await db
      .select()
      .from(webNotifyTemplates)
      .where(eq(webNotifyTemplates.lang, target))
      .limit(1)
  )[0];

  const values = { lang: target, subject, lead, footer, updatedBy: admin.id };

  if (existing) {
    await db
      .update(webNotifyTemplates)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(webNotifyTemplates.id, existing.id));
  } else {
    await db.insert(webNotifyTemplates).values(values);
  }

  await writeAudit({
    actor: admin,
    action: "NOTIFY_TEMPLATE_UPDATE",
    entityType: "web_notify_templates",
    summary: `알림 메일 문구 수정 (${target})`,
    changes: { subject, lead, footer },
  });

  revalidatePath("/settings/notify");
  return { ok: "저장했습니다." };
}

/* ------------------------------------------------------------------ */
/* 수동 발송 — 1일에 나갔어야 했던 메일을 지금 다시 보낸다               */
/*                                                                     */
/* 🔴 왜 있는가 (2026-11-18)                                            */
/* 11-01 배치는 "계측기 2대 · 3명에게 보냈습니다 · 정상 종료" 로 끝났고   */
/* web_notifications 에도 SENT 로 적혔는데, **아무도 받지 못했다.**      */
/* 보내는 주소(SMTP_FROM)의 도메인에 글자가 하나 더 붙어 있어서, 메일    */
/* 서버는 로그인된 계정으로 받아 주고 받는 쪽은 없는 도메인에서 온       */
/* 메일이라 조용히 버렸다. "보냈다고 기록됐는데 실제로는 못 받은" 상태가  */
/* 실재한다 — 그때 다시 보낼 길이 화면에 있어야 한다. 그 전에는 NAS 에    */
/* SSH 로 붙어 긴 docker 명령을 쳐야만 가능했다.                         */
/* ------------------------------------------------------------------ */

/**
 * 🔴 같은 기한을 동시에 두 번 보내지 않는다.
 *
 * 화면의 단추는 보내는 동안 잠긴다. 그래도 창을 두 개 열어 두었거나 브라우저가
 * 멈춘 뒤 다시 눌렀으면 요청이 두 번 올 수 있고, 메일은 되돌릴 수 없다.
 *
 * 🔵 한 프로세스 안에서만 듣는 자물쇠다. 운영은 컨테이너 하나로 돌아서 이것으로
 * 족하다. 여러 개로 늘리는 날에는 DB 자물쇠로 올려야 한다 — 그때 이 주석이
 * 거짓이 되므로 함께 고칠 것.
 */
const sendingYms = new Set<string>();

/**
 * 🔴 **인자를 아예 받지 않는다.** `useActionState` 는 앞선 상태와 폼 값을
 * 넘기지만 여기서는 받지 않으므로 그대로 버려진다 — 읽을 수 있는 자리가
 * 없으면 잘못 읽을 수도 없다. 기한·대상·받는 사람은 전부 서버가 다시 정한다.
 * 폼에서 받으면 필드 하나로 아무 기한이나 쏘는 통로가 된다.
 */
export async function resendNotifyAction(): Promise<NotifyFormState> {
  // 🔴 화면에서 단추를 숨기는 것만으로는 막은 것이 아니다. 이 액션은 화면을
  //    거치지 않고도 불릴 수 있다.
  const admin = await requireAdmin();

  // 설정 화면의 안내 문구가 쓰는 것과 **같은 함수**라, 화면에 적힌 기한과
  // 실제로 나가는 기한이 같다.
  const ym = nextNotifyYm();

  // 🔴 "이미 보냈는가"(alreadySent)는 **일부러 보지 않는다.** 이미 보낸 기한을
  //    다시 보내는 것이 이 단추의 존재 이유다. 배치(send-notify)는 그 검사를
  //    그대로 가지고 있으므로 자동 발송이 두 번 나가는 일은 없다.
  const [meters, recipients] = await Promise.all([
    listNotifyTargets(ym),
    listActiveRecipients(),
  ]);

  // 보낼 것이 없으면 메일 서버에 붙지도 않는다. 단추도 꺼 두지만 여기서 한 번 더 본다.
  if (meters.length === 0) {
    return { error: `${ym} 기한인 계측기가 없습니다. 보낼 것이 없습니다.` };
  }
  if (recipients.length === 0) {
    return { error: "받는 사람이 없습니다. 위에서 먼저 등록하세요." };
  }

  if (sendingYms.has(ym)) {
    return { error: "이미 보내는 중입니다. 끝날 때까지 기다리세요." };
  }
  sendingYms.add(ym);

  let sent = 0;
  let failures: string[] = [];
  try {
    // 메일 속 링크는 env 를 거쳐 읽는다 — SITE_URL 이 'auto' 로 적혀 있어도
    // 이 기계의 사내망 주소로 풀린다.
    const bodies = await renderNotifyBodies({
      meters,
      recipients,
      ym,
      url: env.siteUrl,
    });
    const delivery = await deliverNotifyMails({
      recipients,
      bodies,
      transport: createTransport(),
    });
    sent = delivery.sent;
    failures = delivery.failures;
  } catch (error) {
    // 메일 서버에 아예 못 붙은 경우(설정 누락·연결 거절). 한 통도 안 나갔다.
    // 🔴 여기서 던지면 화면에 500 만 뜨고 아무 기록도 안 남는다 — 오늘 같은
    //    사고를 되짚을 수 없게 된다. 삼키고 아래에서 기록·보고한다.
    failures = [error instanceof Error ? error.message : String(error)];
  } finally {
    sendingYms.delete(ym);
  }

  // 🔴 기록은 **감사 로그**에 남긴다. web_notifications 에는 적지 않는다.
  //    그 표는 "이 기한은 배치가 보냈다" 는 자물쇠이기도 해서, 성공 기록이
  //    기한당 하나뿐이도록 유니크 인덱스(result='SENT' 인 행에만 걸린다)가
  //    박혀 있다. 수동 발송은 그 자물쇠를 일부러 넘는 행위라 거기에 끼워
  //    넣으려면 둘 중 하나를 해야 하는데, 기존 행을 덮어쓰면 **처음 언제
  //    나갔는지**가 사라지고(11-01 사고를 되짚은 근거가 바로 그 값이다),
  //    FAILED 로 적으면 거짓말이 된다. 사람이 한 일을 적는 자리는 원래
  //    감사 로그다. 발송 기록 화면이 두 자리를 합쳐서 보여 준다.
  await writeAudit({
    actor: admin,
    action: "NOTIFY_RESEND",
    entityType: "web_notifications",
    summary: `교정 기한 알림 수동 발송: ${ym} ${meters.length}대 → ${sent}명`,
    changes: {
      targetYm: ym,
      meterCount: meters.length,
      sent,
      failed: failures.length,
      error: failures.length > 0 ? failures.join(" / ").slice(0, 2000) : null,
    },
  });

  revalidatePath("/settings/notify");

  // 🔴 결과를 반드시 말한다. 조용히 끝내면 11-01 과 같은 일이 반복된다 —
  //    "보냈다는데 안 왔다". 몇 명에게 갔는지, 실패했으면 까닭이 무엇인지.
  const reason = failures.join(" / ").slice(0, 300);
  if (sent === 0) {
    return {
      error: `아무에게도 보내지 못했습니다 — ${reason || "까닭을 알 수 없습니다"}`,
    };
  }
  return {
    ok:
      failures.length === 0
        ? `${ym} 기한 ${meters.length}대를 ${sent}명에게 보냈습니다.`
        : `${ym} 기한 ${meters.length}대를 ${sent}명에게 보냈습니다. ${failures.length}명은 실패했습니다 — ${reason}`,
  };
}
