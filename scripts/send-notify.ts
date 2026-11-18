/**
 * 교정 기한 알림 메일 발송.
 *
 *   npm run send-notify                  매달 1일에만 실제로 나간다
 *   npm run send-notify -- --dry         보내지 않고 무엇이 나갈지만 본다
 *   npm run send-notify -- --force       1일이 아니어도, 이미 보냈어도 보낸다
 *   npm run send-notify -- --ym=2027-01  그 기한을 대상으로 (재발송·확인용)
 *
 * **NAS 의 DSM 작업 스케줄러**(「DSS 교정 알림」)가 매일 09:00 에 root 로
 * `/volume1/dss/jobs/notify-daily.sh` 를 돌리고, 그 스크립트가 도구 컨테이너에서
 * 이것을 부른다. 1일이 아닌 날은 아무것도 하지 않는다 — 매일 걸어 두어도 된다.
 * (2026-09-18 NAS 배포 전에는 개발 PC 의 Windows 작업 스케줄러였다.)
 * 날짜 계산을 스케줄러가 아니라 이 안에서 하는 이유는, 스케줄러 설정이
 * 어딘가에서 조용히 바뀌어도 규칙은 코드에 남아 있게 하기 위해서다.
 *
 * 같은 기한을 두 번 보내지 않는다 — web_notifications 에 성공 기록이 있으면 건너뛴다.
 * PowerShell 이 아니라 TypeScript 로 작성한다 — NAS 리눅스 컨테이너에서도 돌아야 한다.
 *
 * 🔴 **실제로 메일을 내보내는 몸통은 `src/lib/notify-send.ts` 에 있다.** 설정
 * 화면의 수동 발송 단추가 같은 코드를 쓰기 위해 2026-11-18 에 그리로 옮겼다.
 * 옮기면서 이 스크립트의 동작은 한 글자도 바꾸지 않았다 — 언제 보내는지,
 * 무엇을 건너뛰는지, 기록을 어떻게 남기는지는 여전히 **여기서** 정한다.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { EOL } from "node:os";
import path from "node:path";

import postgres from "postgres";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

/**
 * 화면에 찍은 것을 그대로 로그 파일에도 남긴다 (백업 스크립트와 같은 방식).
 * 작업 스케줄러로 돌 때는 아무도 화면을 보지 않는다. 1일이 아니라 그냥
 * 끝난 날도 남겨 두어야 "돌기는 했는지" 를 나중에 알 수 있다.
 *
 * 🔴 **NAS 에서는 이 파일이 남지 않는다.** 도구 컨테이너는 `--rm` 으로 잠깐
 * 떴다 사라지고 `/app/logs` 에 볼륨이 붙어 있지 않다. 거기서 실제로 남는 것은
 * 이것을 부르는 jobs/notify-daily.sh 가 stdout 을 받아 적는
 * `/volume1/dss/setup/logs/notify-*.log` 다 — 그래서 **say() 로 찍는 줄이 곧
 * 운영 기록**이다. 이 파일은 개발 PC 에서 손으로 돌릴 때에 쓸모가 있다.
 */
const logLines: string[] = [];
function say(line = ""): void {
  console.log(line);
  logLines.push(line);
}

async function flushLog(ok: boolean): Promise<void> {
  try {
    const dir = path.join(process.cwd(), "logs");
    await mkdir(dir, { recursive: true });
    const head = `===== ${new Date().toISOString()} ${ok ? "성공" : "실패"} =====`;
    await appendFile(
      path.join(dir, "notify.log"),
      [head, ...logLines, ""].join(EOL),
      "utf8",
    );
  } catch {
    // 로그를 못 남기는 것이 발송 자체를 실패로 만들지는 않게 한다.
  }
}

const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

/** --ym=2027-01 로 기한을 직접 정한다. 없으면 오늘로부터 계산한다. */
const GIVEN_YM = (() => {
  const arg = process.argv.find((a) => a.startsWith("--ym="));
  if (!arg) return null;
  const value = arg.slice("--ym=".length);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    console.error(`--ym 은 YYYY-MM 형식이어야 합니다: ${value}`);
    process.exit(1);
  }
  return value;
})();

async function main() {
  // 배치 전용 연결. 앱과 같은 풀을 쓰지 않는다.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    const { addMonths, currentDate } = await import("../src/lib/meters");
    const { listNotifyTargets, notifyTargetYm } = await import("../src/lib/notify");
    const { alreadySent, findSentNotification, listActiveRecipients } =
      await import("../src/lib/notify-admin");
    const { deliverNotifyMails, renderNotifyBodies } = await import(
      "../src/lib/notify-send"
    );
    const { createTransport } = await import("../src/lib/mail/transport");
    const { db } = await import("../src/lib/db");
    const { webAuditLogs, webNotifications } = await import(
      "../src/lib/db/schema"
    );

    const today = currentDate();
    const scheduled = notifyTargetYm(today);

    if (!scheduled && !FORCE && !GIVEN_YM) {
      say(`${today} — 매달 1일이 아닙니다. 보낼 것이 없습니다.`);
      return;
    }

    const ym = GIVEN_YM ?? scheduled ?? addMonths(today.slice(0, 7), 1);

    if (!FORCE && (await alreadySent(ym))) {
      say(`${ym} 기한은 이미 보냈습니다. 두 번 보내지 않습니다.`);
      return;
    }

    const [meters, recipients] = await Promise.all([
      listNotifyTargets(ym),
      listActiveRecipients(),
    ]);

    say(`오늘        ${today}`);
    say(`대상 기한   ${ym}`);
    say(`계측기      ${meters.length}대`);
    say(`받는 사람   ${recipients.length}명`);
    say("");

    if (meters.length === 0) {
      say("알릴 계측기가 없습니다. 메일을 보내지 않습니다.");
      return;
    }
    if (recipients.length === 0) {
      say("받는 사람이 없습니다. 설정 화면에서 등록하세요.");
      say("  http://localhost:3200/settings/notify");
      return;
    }

    const url = (process.env.SITE_URL ?? "http://localhost:3200").replace(
      /\/$/,
      "",
    );

    // 언어별로 한 번씩만 만든다. 같은 언어를 쓰는 사람이 여럿이어도 본문은 하나다.
    const bodies = await renderNotifyBodies({ meters, recipients, ym, url });

    if (DRY) {
      for (const [lang, mail] of bodies) {
        const who = recipients.filter((r) => r.lang === lang).map((r) => r.email);
        say(`[${lang}] ${mail.subject}`);
        say(`      → ${who.join(", ")}`);
      }
      say("");
      say("--dry 라서 실제로 보내지 않았습니다.");
      return;
    }

    // 보내는 몸통은 화면의 수동 발송 단추와 같은 것을 쓴다. 한 사람에게
    // 실패해도 나머지는 보내고, 끝나면 연결을 닫는 것까지 그쪽이 한다.
    const { sent, failures } = await deliverNotifyMails({
      recipients,
      bodies,
      transport: createTransport(),
      onLine: say,
    });

    // 한 명이라도 보냈으면 성공으로 남긴다. 전부 실패면 실패로 남기고
    // 다음 번 실행에서 다시 시도할 수 있게 한다.
    //
    // 🔴 **부딪혀도 터지지 않는다** (2026-11-18). 한 기한에 성공 기록은 하나뿐이고
    //    (web_notifications_target_ym_uq — result='SENT' 인 행에만 걸린 유니크
    //    인덱스다), --force 로 이미 보낸 기한을 다시 보내면 바로 여기서 부딪힌다.
    //    그 전까지는 그대로 터졌다 — **메일은 이미 다 나간 뒤**라서 아래 감사
    //    로그까지 가지도 못하고 exit 1 로 끝났고, 사람은 "실패했다"고 읽었다.
    //    메일은 나갔는데 아무 데도 안 남는, 가장 나쁜 모양이다.
    //    이제는 부딪히면 **있는 행을 그대로 둔다.** 덮어쓰지 않는 까닭은 덮어쓰면
    //    처음 보낸 날(sent_on)이 사라지기 때문이다 — 그 값이 "언제 나갔다는데
    //    못 받았다" 를 나중에 되짚는 유일한 근거다. 화면의 수동 발송 단추도 같은
    //    규율이다(app/actions/notify.ts 의 resendNotifyAction).
    // 🔵 자물쇠가 풀리는 것이 아니다. 1일 배치가 두 번 보내지 않는 것은 위의
    //    alreadySent 검사가 막는 것이고(메일은 그보다 먼저 나간다), 이 인덱스는
    //    처음부터 **기록**이 겹치지 않게 하는 장치다. 둘은 다른 일을 한다.
    const recorded = await db
      .insert(webNotifications)
      .values({
        targetYm: ym,
        sentOn: today,
        meterCount: meters.length,
        recipientCount: sent,
        result: sent > 0 ? "SENT" : "FAILED",
        error: failures.length > 0 ? failures.join(" / ").slice(0, 2000) : null,
      })
      .onConflictDoNothing()
      .returning({ id: webNotifications.id });

    if (recorded.length === 0) {
      // 🔴 조용히 넘어가지 않는다. 그러면 다음 사람이 "보냈다는데 기록은 왜
      //    안 늘지" 로 또 헤맨다. 메일이 나간 것과 기록을 그대로 둔 것은
      //    **둘 다** 로그에 보여야 한다.
      const first = await findSentNotification(ym);
      say(
        `기록은 그대로 둡니다 — ${ym} 기한의 성공 기록이 이미 있습니다` +
          (first ? ` (처음 보낸 날 ${first.sentOn}, ${first.recipientCount}명).` : "."),
      );
    }

    // 중요한 행위는 감사 로그에도 남긴다. 배치라 사람(actor)이 없다.
    // writeAudit 는 next/headers 를 쓰므로 여기서는 직접 넣는다.
    await db.insert(webAuditLogs).values({
      actorUserId: null,
      actorName: "(알림 배치)",
      action: "NOTIFY_SEND",
      entityType: "web_notifications",
      summary: `교정 기한 알림: ${ym} ${meters.length}대 → ${sent}명`,
      changes: { targetYm: ym, sent, failed: failures.length },
    });

    say("");
    say(
      sent > 0
        ? `=> ${sent}명에게 보냈습니다.${failures.length ? ` (${failures.length}명 실패)` : ""}`
        : "=> 아무에게도 보내지 못했습니다. npm run check-smtp 로 확인하세요.",
    );
    if (sent === 0) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main()
  .then(() => flushLog(process.exitCode !== 1))
  .catch(async (error) => {
    // 터져도 조용히 끝나지 않게 한다. 스케줄러는 화면을 보지 않는다.
    say(`오류: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    await flushLog(false);
  });
