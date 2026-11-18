/**
 * 교정 기한 알림 메일을 **실제로 보내는 몸통**.
 *
 * 2026-11-18 에 `scripts/send-notify.ts` 에서 그대로 끌어냈다. 까닭은 하나다 —
 * 설정 화면의 수동 발송 단추가 같은 일을 해야 하는데, 두 곳에 같은 코드를
 * 적으면 한쪽만 고쳐져 "배치로 나간 메일"과 "손으로 보낸 메일"이 달라진다.
 *
 * 🔴 끌어내면서 동작은 한 글자도 바꾸지 않았다. 보내는 차례도, 한 사람이
 * 실패해도 나머지를 보내는 것도, 로그에 찍는 글(`  보냄  …`)도 그대로다 —
 * NAS 스케줄러가 매일 09:00 에 이 길을 돈다.
 *
 * 여기서 하지 **않는** 것 셋:
 *  - 대상과 받는 사람을 고르지 않는다 (`notify.ts` · `notify-admin.ts` 가 한다)
 *  - 보낼지 말지를 정하지 않는다 (1일인지·이미 보냈는지는 부르는 쪽이 본다)
 *  - 기록을 남기지 않는다. 배치와 수동 발송이 적는 자리가 서로 다르다
 *    (배치는 `web_notifications`, 수동은 감사 로그 — 까닭은 `actions/notify.ts`).
 */
import type { WebMeter, WebNotifyRecipient } from "@/lib/db/schema";
import type { Lang } from "@/lib/i18n";
import {
  loadTemplate,
  renderNotifyMail,
  type NotifyMail,
} from "@/lib/mail/notify-mail";
import { fromAddress } from "@/lib/mail/transport";

/**
 * 메일을 내보내는 것. nodemailer 의 `Transporter` 가 그대로 들어맞되,
 * **쓰는 만큼만** 적어 둔다 — 시험에서 가짜를 끼워 실제로 메일이 나가지 않게
 * 하려면 이 두 가지 외에 더 요구해서는 안 된다. 받는 사람이 실제 직원이라
 * 시험이 진짜로 보내는 일은 절대 없어야 한다.
 */
export type MailSender = {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
  close(): void;
};

/** 받는 사람 한 명의 발송 결과까지 합친 것. */
export type NotifyDelivery = {
  /** 실제로 나간 통 수 */
  sent: number;
  /** `주소: 까닭` 꼴. 비어 있으면 전부 나갔다. */
  failures: string[];
};

/**
 * 본문을 몇 벌 만들어야 하는가.
 *
 * 같은 언어를 쓰는 사람이 여럿이어도 본문은 하나다 — 받는 사람 수만큼 만들면
 * 사람 수만큼 DB(문구 표)를 읽게 된다.
 *
 * 🔴 돌려주는 `key` 는 **DB 에 적힌 값 그대로**다. 보낼 때 `person.lang` 으로
 * 본문을 찾기 때문에, 여기서 `ko`·`ja` 로 정리해 버리면 그 사람의 본문을 못
 * 찾는다. 모르는 값은 한국어 본문을 쓰되 열쇠는 원래 값으로 남긴다.
 */
export function bodyLangs(
  recipients: readonly WebNotifyRecipient[],
): { key: string; lang: Lang }[] {
  return [...new Set(recipients.map((r) => r.lang))].map((key) => ({
    key,
    lang: key === "ja" ? "ja" : "ko",
  }));
}

/** 언어별 메일 본문. 문구는 DB(`web_notify_templates`)에서 읽는다. */
export async function renderNotifyBodies({
  meters,
  recipients,
  ym,
  url,
}: {
  meters: WebMeter[];
  recipients: readonly WebNotifyRecipient[];
  ym: string;
  url: string;
}): Promise<Map<string, NotifyMail>> {
  const bodies = new Map<string, NotifyMail>();
  for (const { key, lang } of bodyLangs(recipients)) {
    bodies.set(
      key,
      renderNotifyMail({
        meters,
        ym,
        lang,
        url,
        template: await loadTemplate(lang),
      }),
    );
  }
  return bodies;
}

/**
 * 한 사람씩 보낸다.
 *
 * 🔴 한 사람에게 실패해도 멈추지 않는다. 주소 하나가 오타라고 나머지 사람이
 * 못 받으면 안 된다 — 실패한 사람만 `failures` 에 모아 돌려준다.
 *
 * `onLine` 은 배치가 로그 파일에 남길 줄을 받는 자리다. 화면에서 부를 때는
 * 넘기지 않는다(아무도 서버 콘솔을 보지 않는다 — 결과는 돌려받아 화면에 적는다).
 */
export async function deliverNotifyMails({
  recipients,
  bodies,
  transport,
  onLine,
}: {
  recipients: readonly WebNotifyRecipient[];
  bodies: Map<string, NotifyMail>;
  transport: MailSender;
  onLine?: (line: string) => void;
}): Promise<NotifyDelivery> {
  let sent = 0;
  const failures: string[] = [];

  try {
    for (const person of recipients) {
      const mail = bodies.get(person.lang)!;
      try {
        await transport.sendMail({
          from: fromAddress(),
          to: person.name ? `${person.name} <${person.email}>` : person.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        sent += 1;
        onLine?.(`  보냄  ${person.email}`);
      } catch (error) {
        // 한 사람에게 실패해도 나머지는 보낸다.
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${person.email}: ${message}`);
        onLine?.(`  실패  ${person.email} — ${message}`);
      }
    }
  } finally {
    transport.close();
  }

  return { sent, failures };
}
