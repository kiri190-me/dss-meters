/**
 * ============================================================================
 * 🔴 수동 발송 — "보냈다고 적혔는데 아무도 못 받은" 다음에 누르는 단추
 * ============================================================================
 * 2026-11-01 09:00 에 배치는 정상으로 끝났다. 로그는 "계측기 2대 · 받는 사람
 * 3명 · 3명에게 보냈습니다 · 정상 종료(0)" 였고 web_notifications 에도 SENT 로
 * 적혔다. 🔴 그런데 아무도 받지 못했다 — 보내는 주소(SMTP_FROM)의 도메인에
 * 글자가 하나 더 붙어 있어서, 메일 서버는 로그인된 계정으로 받아 주고 받는
 * 쪽은 없는 도메인에서 온 메일이라 조용히 버렸다. 설정은 고쳤지만, "기록은
 * 보냄인데 실제로는 못 받은" 상태가 실재한다는 것이 남았다.
 *
 * 그래서 설정 화면에 단추를 하나 두었다. 이 시험이 지키는 것은 여섯이다:
 *
 *  1. 🔴 **스케줄러가 쓰는 길이 안 바뀌었다.** 보내는 몸통을 공용으로
 *     끌어내면서 scripts/send-notify.ts 의 동작은 한 글자도 바꾸지 않았다.
 *     여기가 깨지면 매일 09:00 의 자동 알림이 통째로 멈춘다 — 이 절이 가장 중요하다.
 *  2. 🔴 **관리자만 부를 수 있다.** 화면에서 단추를 숨기는 것으로는 안 된다.
 *  3. 🔴 **이미 보낸 기한이어도 보낸다.** 그것이 이 단추의 존재 이유다.
 *  4. 🔴 **보낼 것이 없으면 메일 서버에 붙지도 않는다.**
 *  5. 🔴 **기록이 남고 결과를 말한다.** 조용히 끝내면 11-01 이 되풀이된다.
 *  6. 🔴 **두 번 눌러도 두 번 나가지 않는다.**
 *
 * 🔴 이 시험은 메일을 한 통도 보내지 않는다. 받는 사람은 실제 직원이다 —
 *    보내는 자리에는 가짜를 끼우고, SMTP 설정도 아무도 듣지 않는 값을 넣는다.
 * 🔴 DB 에도 닿지 않는다. 조회를 한 번도 하지 않고, 주소만 가짜로 채운다
 *    (lib/db 가 모듈 꼭대기에서 접속 풀을 만들기 때문에 주소는 있어야 한다).
 * ============================================================================
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { WebNotifyRecipient } from "@/lib/db/schema";

/* ── 🔴 바깥에 닿지 않게 먼저 막는다 ──────────────────────────────────────
 * 정적 import 는 이 줄들보다 **먼저** 실행된다. 그래서 DB·메일을 건드리는
 * 모듈은 아래 테스트 안에서 동적으로 불러온다.
 * 값은 전부 가짜다. 127.0.0.1:1 은 아무도 듣지 않고, 이 시험은 조회도 발송도
 * 하지 않으므로 연결 자체가 열리지 않는다. 혹시 열린다면 그것이 결함이다. */
process.env.DATABASE_URL = "postgres://notest:notest@127.0.0.1:1/notest";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";
process.env.SMTP_USER = "notest@invalid";
process.env.SMTP_PASSWORD = "가짜-비밀번호";
process.env.SMTP_FROM = "notest@invalid";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs
    .readFileSync(path.resolve(ROOT, relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

/** 주석을 걷어 낸 코드. 🔴 주석에 적힌 낱말이 시험을 통과·탈락시키지 않게. */
function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const SCRIPT_PATH = "scripts/send-notify.ts";
const ACTION_PATH = "src/app/actions/notify.ts";
const FORM_PATH = "src/components/ResendNotifyForm.tsx";
const PAGE_PATH = "src/app/(internal)/settings/notify/page.tsx";

const scriptRaw = read(SCRIPT_PATH);
const script = withoutComments(scriptRaw);
const actionRaw = read(ACTION_PATH);
const actionFile = withoutComments(actionRaw);
const formRaw = read(FORM_PATH);
const form = withoutComments(formRaw);
const page = withoutComments(read(PAGE_PATH));

/** 수동 발송 액션의 **본문만**. 같은 파일의 다른 액션이 섞이면 뜻이 흐려진다. */
const resend = actionFile.slice(
  actionFile.indexOf("export async function resendNotifyAction"),
);

test("🔴 재는 대상이 비어 있지 않다 — 파일 자리가 바뀌면 아래가 전부 공짜로 통과한다", () => {
  assert.ok(script.includes("async function main()"), SCRIPT_PATH);
  assert.ok(resend.length > 0, "수동 발송 서버 액션을 찾지 못했다");
  assert.ok(form.includes("export function ResendNotifyForm"), FORM_PATH);
  assert.ok(page.includes("export default async function NotifySettingsPage"), PAGE_PATH);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 1. 보내는 몸통 — 가짜 메일 서버에 **실제로** 보내 본다
 * ═════════════════════════════════════════════════════════════════════════ */

type SentMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** 보낸 것을 모아 두는 가짜. 🔴 밖으로 한 바이트도 나가지 않는다. */
function fakeMailServer(options: { failFor?: (to: string) => unknown } = {}) {
  const outbox: SentMail[] = [];
  const state = { closed: 0 };
  const transport = {
    async sendMail(message: SentMail) {
      const why = options.failFor?.(message.to);
      if (why !== undefined && why !== null) throw why;
      outbox.push(message);
      return { accepted: [message.to] };
    },
    close() {
      state.closed += 1;
    },
  };
  return { outbox, state, transport };
}

/** 받는 사람 한 줄. 🔴 값은 전부 가짜다 — 실제 직원 주소를 적지 않는다. */
function recipient(
  overrides: Partial<WebNotifyRecipient> = {},
): WebNotifyRecipient {
  const now = new Date("2026-11-18T00:00:00Z");
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "someone@invalid",
    name: null,
    lang: "ko",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    ...overrides,
  };
}

function mail(label: string) {
  return {
    subject: `${label} 제목`,
    text: `${label} 글자본문`,
    html: `<p>${label} 본문</p>`,
  };
}

const BODIES = new Map([
  ["ko", mail("ko")],
  ["ja", mail("ja")],
]);

async function sendModule() {
  return import("./notify-send");
}

test("받는 사람마다 한 통씩, 제 언어의 본문으로 나간다", async () => {
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer();

  const recipients = [
    recipient({ email: "ko1@invalid", name: "홍길동" }),
    recipient({ email: "ja1@invalid", lang: "ja" }),
    recipient({ email: "ko2@invalid" }),
  ];

  const result = await deliverNotifyMails({
    recipients,
    bodies: BODIES,
    transport: server.transport,
  });

  assert.deepEqual(result, { sent: 3, failures: [] });
  assert.deepEqual(
    server.outbox.map((m) => m.to),
    // 이름이 있으면 「이름 <주소>」, 없으면 주소만. 차례는 받은 목록 그대로다.
    ["홍길동 <ko1@invalid>", "ja1@invalid", "ko2@invalid"],
  );
  assert.deepEqual(
    server.outbox.map((m) => m.subject),
    ["ko 제목", "ja 제목", "ko 제목"],
  );
});

test("🔴 보내는 사람은 설정(SMTP_FROM)에서 온다 — 코드에 박혀 있지 않다", async () => {
  // 11-01 사고의 뿌리가 바로 이 값이었다. 오타 자체는 시험으로 못 잡지만,
  // **설정을 고치면 바뀌는 값**이어야 한다는 선은 여기서 지킨다.
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer();

  await deliverNotifyMails({
    recipients: [recipient({ email: "ko1@invalid" })],
    bodies: BODIES,
    transport: server.transport,
  });

  assert.equal(server.outbox[0].from, "DSS 계측기 관리 <notest@invalid>");
  assert.ok(
    server.outbox[0].from.includes(process.env.SMTP_FROM!),
    "보내는 주소가 설정과 다르다",
  );
});

test("🔴 한 사람이 실패해도 나머지는 간다 — 실패한 사람만 까닭과 함께 남는다", async () => {
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer({
    failFor: (to) =>
      to === "나쁜주소@invalid" ? new Error("550 없는 주소입니다") : null,
  });

  const result = await deliverNotifyMails({
    recipients: [
      recipient({ email: "첫째@invalid" }),
      recipient({ email: "나쁜주소@invalid" }),
      recipient({ email: "셋째@invalid" }),
    ],
    bodies: BODIES,
    transport: server.transport,
  });

  assert.equal(result.sent, 2, "🔴 하나가 실패해서 나머지가 멈췄다");
  assert.deepEqual(result.failures, ["나쁜주소@invalid: 550 없는 주소입니다"]);
  assert.deepEqual(
    server.outbox.map((m) => m.to),
    ["첫째@invalid", "셋째@invalid"],
  );
});

test("Error 가 아닌 것이 날아와도 까닭이 글로 남는다", async () => {
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer({ failFor: () => "연결이 거절되었습니다" });

  const result = await deliverNotifyMails({
    recipients: [recipient({ email: "하나@invalid" })],
    bodies: BODIES,
    transport: server.transport,
  });

  assert.equal(result.sent, 0);
  assert.deepEqual(result.failures, ["하나@invalid: 연결이 거절되었습니다"]);
});

test("🔴 끝나면 연결을 닫는다 — 전부 실패해도 닫는다", async () => {
  const { deliverNotifyMails } = await sendModule();

  const 멀쩡할때 = fakeMailServer();
  await deliverNotifyMails({
    recipients: [recipient()],
    bodies: BODIES,
    transport: 멀쩡할때.transport,
  });
  assert.equal(멀쩡할때.state.closed, 1, "🔴 보내고 나서 연결을 안 닫았다");

  const 다실패 = fakeMailServer({ failFor: () => new Error("끊겼다") });
  await deliverNotifyMails({
    recipients: [recipient(), recipient({ email: "둘@invalid" })],
    bodies: BODIES,
    transport: 다실패.transport,
  });
  assert.equal(다실패.state.closed, 1, "🔴 실패한 뒤 연결이 남는다");
});

test("받는 사람이 없으면 한 통도 안 나간다 — 그래도 연결은 닫는다", async () => {
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer();

  const result = await deliverNotifyMails({
    recipients: [],
    bodies: BODIES,
    transport: server.transport,
  });

  assert.deepEqual(result, { sent: 0, failures: [] });
  assert.equal(server.outbox.length, 0);
  assert.equal(server.state.closed, 1);
});

test("🔴 배치가 로그 파일에 남길 줄이 그대로다 — 스케줄러는 이 글만 남긴다", async () => {
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer({
    failFor: (to) => (to === "실패@invalid" ? new Error("끊겼다") : null),
  });

  const lines: string[] = [];
  await deliverNotifyMails({
    recipients: [
      recipient({ email: "성공@invalid" }),
      recipient({ email: "실패@invalid" }),
    ],
    bodies: BODIES,
    transport: server.transport,
    onLine: (line) => lines.push(line),
  });

  // 🔴 글자 하나까지 2026-11-18 이전과 같다. 사람이 이 모양을 보고 읽는다.
  assert.deepEqual(lines, [
    "  보냄  성공@invalid",
    "  실패  실패@invalid — 끊겼다",
  ]);
});

test("onLine 을 안 넘겨도 터지지 않는다 — 화면에서 부를 때는 아무도 안 듣는다", async () => {
  const { deliverNotifyMails } = await sendModule();
  const server = fakeMailServer();
  const result = await deliverNotifyMails({
    recipients: [recipient()],
    bodies: BODIES,
    transport: server.transport,
  });
  assert.equal(result.sent, 1);
});

test("본문은 언어마다 한 벌만 만든다 — 열쇠는 DB 에 적힌 값 그대로다", async () => {
  const { bodyLangs } = await sendModule();

  assert.deepEqual(
    bodyLangs([
      recipient({ lang: "ko" }),
      recipient({ lang: "ja" }),
      recipient({ lang: "ko" }),
    ]),
    [
      { key: "ko", lang: "ko" },
      { key: "ja", lang: "ja" },
    ],
  );
  // 🔴 모르는 값은 한국어 본문을 쓰되 **열쇠는 원래 값**이다. 여기서 ko 로
  //    바꿔 적으면 그 사람의 본문을 못 찾아 보내는 중에 터진다.
  assert.deepEqual(bodyLangs([recipient({ lang: "en" })]), [
    { key: "en", lang: "ko" },
  ]);
  assert.deepEqual(bodyLangs([]), []);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2. 🔴 스케줄러가 쓰는 길이 안 바뀌었다 — scripts/send-notify.ts
 * ══════════════════════════════════════════════════════════════════════════
 * NAS 가 매일 09:00 에 이것을 돌린다. 보내는 몸통만 lib 로 옮겼고, **언제
 * 보내는지 · 무엇을 건너뛰는지 · 기록을 어떻게 남기는지**는 그대로 여기 있다.
 * ═════════════════════════════════════════════════════════════════════════ */

test("🔴 1일이 아니면 아무것도 하지 않는다", () => {
  assert.match(script, /if \(!scheduled && !FORCE && !GIVEN_YM\) \{/);
  assert.match(script, /매달 1일이 아닙니다\. 보낼 것이 없습니다\./);
  assert.match(
    script,
    /const ym = GIVEN_YM \?\? scheduled \?\? addMonths\(today\.slice\(0, 7\), 1\);/,
  );
});

test("🔴 이미 보낸 기한은 건너뛴다 — 배치는 여전히 alreadySent 를 본다", () => {
  assert.match(script, /if \(!FORCE && \(await alreadySent\(ym\)\)\) \{/);
  assert.match(script, /기한은 이미 보냈습니다\. 두 번 보내지 않습니다\./);
});

test("🔴 --force 가 번지지 않았다 — 건너뛰는 자리 둘에서만 쓰인다", () => {
  // 선언 1 + 가드 2. 늘어났다면 --force 가 다른 판정까지 뒤집고 있다는 뜻이다.
  assert.equal((script.match(/\bFORCE\b/g) ?? []).length, 3);
  assert.match(script, /const FORCE = process\.argv\.includes\("--force"\);/);
});

test("🔴 --dry 는 보내기 **전에** 돌아간다 — 순서가 뒤집히면 시험 삼아 돌린 것이 진짜로 나간다", () => {
  const dry = script.indexOf("--dry 라서 실제로 보내지 않았습니다.");
  const send = script.indexOf("deliverNotifyMails({");
  assert.ok(dry > 0 && send > 0, "두 자리를 다 찾지 못했다");
  assert.ok(dry < send, "🔴 --dry 블록이 발송 뒤로 밀렸다");
});

test("🔴 보낼 것이 없으면 메일 서버에 붙지도 않는다 — 가드가 발송보다 앞이다", () => {
  const 계측기 = script.indexOf("알릴 계측기가 없습니다.");
  const 사람 = script.indexOf("받는 사람이 없습니다. 설정 화면에서 등록하세요.");
  const 붙는자리 = script.indexOf("createTransport()");
  assert.ok(계측기 > 0 && 사람 > 0 && 붙는자리 > 0);
  assert.ok(계측기 < 붙는자리 && 사람 < 붙는자리);
});

test("🔴 적는 값이 그대로다 — web_notifications 에 한 줄, 결과는 보낸 수로 가른다", () => {
  assert.match(script, /await db\s*\n?\s*\.insert\(webNotifications\)\s*\n?\s*\.values\(\{/);
  assert.match(script, /result: sent > 0 \? "SENT" : "FAILED",/);
  assert.match(script, /recipientCount: sent,/);
  assert.match(
    script,
    /error: failures\.length > 0 \? failures\.join\(" \/ "\)\.slice\(0, 2000\) : null,/,
  );
});

test("🔴 중복 발송을 막는 자물쇠는 **보내기 전**의 검사다 — 그 차례가 그대로다", () => {
  // 🔴 2026-11-18 에 이 시험의 주장을 고쳤다. 전에는 "배치에 onConflict 가
  //    있으면 안 된다 — 두 번 보내지 않는 자물쇠가 풀린다" 로 적혀 있었는데
  //    **전제가 틀렸다.** 메일은 기록보다 **먼저** 나가므로, 유니크 인덱스는
  //    애초에 중복 **발송**을 막은 적이 없다(기록이 겹치지 않게 할 뿐이다).
  //    실제로 막는 것은 아래 두 가지이고, 그것이 그대로인지를 재는 것이 맞다.
  const 일일가드 = script.indexOf("if (!scheduled && !FORCE && !GIVEN_YM)");
  const 중복가드 = script.indexOf("if (!FORCE && (await alreadySent(ym)))");
  const 발송 = script.indexOf("deliverNotifyMails({");
  assert.ok(일일가드 > 0 && 중복가드 > 0 && 발송 > 0, "가드를 찾지 못했다");
  assert.ok(일일가드 < 중복가드 && 중복가드 < 발송, "🔴 가드가 발송 뒤로 밀렸다");
});

/* ── 2-ㄴ. 🔴 --force 로 이미 보낸 기한을 보내도 기록 없이 끝나지 않는다 ──
 * 2026-11-18 까지 `--force` 는 제 주된 쓰임에서 **터졌다.** alreadySent 만
 * 건너뛰고 기록 INSERT 는 그대로라, 이미 성공 기록이 있는 기한에 쓰면
 * **메일은 전부 나간 뒤** 유니크 위반으로 터져 감사 로그도 못 남기고 exit 1
 * 로 끝났다. 사람은 "실패했다" 고 읽는다 — 11-01 사고의 정확한 거울이다. */

test("🔴 기록에 부딪혀도 터지지 않는다 — 있는 행을 그대로 둔다", () => {
  assert.match(script, /\.onConflictDoNothing\(\)/);
  assert.match(script, /\.returning\(\{ id: webNotifications\.id \}\);/);
  assert.match(script, /const recorded = await db/);
});

test("🔴 **덮어쓰지 않는다** — 처음 보낸 날이 사라지면 사고를 되짚을 수 없다", () => {
  assert.equal(
    /onConflictDoUpdate/.test(script),
    false,
    "🔴 충돌할 때 기존 행을 덮어쓴다 — sent_on 이 사라진다",
  );
  assert.equal(
    /db\.update\(webNotifications\)|\.update\(webNotifications\)/.test(script),
    false,
    "🔴 배치가 발송 기록 행을 고친다",
  );
});

test("🔴 부딪힌 뒤에도 **감사 로그까지 간다** — 사이에 돌아가는 길이 없다", () => {
  // 터져서 여기까지 못 오던 것이 이 고침의 핵심이다. 두 기록 사이에 return 이나
  // throw 가 끼면 "메일은 나갔는데 아무 데도 안 남는" 상태가 그대로 돌아온다.
  const 기록 = script.indexOf("const recorded = await db");
  const 감사 = script.indexOf("db.insert(webAuditLogs)");
  assert.ok(기록 > 0 && 감사 > 0);
  assert.ok(기록 < 감사, "🔴 감사 로그가 기록보다 앞이다");

  const 사이 = script.slice(기록, 감사);
  assert.equal(/\breturn\b/.test(사이), false, "🔴 사이에 돌아가는 길이 생겼다");
  assert.equal(/\bthrow\b/.test(사이), false, "🔴 사이에서 던진다");
  assert.equal(/\bcatch\b/.test(사이), false, "🔴 사이에 삼키는 자리가 생겼다");
});

test("🔴 기록을 그대로 둔 사실이 로그에 보인다 — 조용히 넘어가지 않는다", () => {
  assert.match(script, /if \(recorded\.length === 0\) \{/);
  assert.match(script, /say\(\s*`기록은 그대로 둡니다 — \$\{ym\} 기한의 성공 기록이 이미 있습니다`/);
  assert.match(script, /처음 보낸 날 \$\{first\.sentOn\}/);
  // 그 줄이 "기록을 안 적은 경우" 안에만 있어야 한다 — 평소에 뜨면 거짓말이다.
  const 분기 = script.indexOf("if (recorded.length === 0) {");
  const 말하는자리 = script.indexOf("기록은 그대로 둡니다");
  assert.ok(분기 < 말하는자리);
});

test("🔴 종료 코드는 **보낸 수**로만 정해진다 — 기록을 못 적은 것은 실패가 아니다", () => {
  // 메일이 다 나갔으면 0 이어야 한다. 전에는 기록에 부딪혀 터지면서 1 이 됐고,
  // 스케줄러가 '비정상 종료' 로 표시해 사람이 "안 나갔구나" 로 읽었다.
  assert.match(script, /if \(sent === 0\) process\.exitCode = 1;/);
  // 코드를 **1 로 정하는** 자리는 둘뿐이다 — 한 통도 못 보냈을 때와,
  // 맨 아래에서 통째로 터졌을 때. (`flushLog(process.exitCode !== 1)` 은 읽기만 한다.)
  assert.equal(
    (script.match(/process\.exitCode = 1/g) ?? []).length,
    2,
    "🔴 종료 코드를 1 로 정하는 자리가 늘었다",
  );
  const 분기 = script.slice(
    script.indexOf("if (recorded.length === 0) {"),
    script.indexOf("db.insert(webAuditLogs)"),
  );
  assert.equal(
    /exitCode/.test(분기),
    false,
    "🔴 기록을 못 적었다고 실패로 끝낸다",
  );
});

test("🔵 .onConflictDoNothing() 이 정말 '그대로 둔다' 로 번역된다 — 뿜는 SQL 을 본다", async () => {
  // 🔴 이 조각은 DB 에 붙지 못하는 자리에서 만들었다. 그래서 "충돌해도 안
  //    터진다" 를 직접 돌려 볼 수가 없다 — 대신 **무슨 문장이 나가는지**를
  //    본다. toSQL() 은 글자를 만들 뿐 서버에 가지 않는다.
  const { db } = await import("./db");
  const { webNotifications } = await import("./db/schema");

  const built = db
    .insert(webNotifications)
    .values({
      targetYm: "2026-12",
      sentOn: "2026-11-18",
      meterCount: 2,
      recipientCount: 3,
      result: "SENT",
      error: null,
    })
    .onConflictDoNothing()
    .returning({ id: webNotifications.id })
    .toSQL();

  // 실측(2026-11-18, drizzle-orm 0.45): insert into "web_notifications" (…)
  //   values (default, $1, …, default) on conflict do nothing returning "id"
  assert.match(built.sql, /insert into "web_notifications"/i);
  assert.match(built.sql, /on conflict do nothing/i);
  assert.match(built.sql, /returning "id"/i);
  // 🔴 덮어쓰는 쪽으로 번역되면 처음 보낸 날이 사라진다.
  assert.equal(/do update/i.test(built.sql), false, built.sql);
});

test("🔴 배치의 감사 로그는 NOTIFY_SEND 다 — 수동 발송과 가른다", () => {
  assert.match(script, /action: "NOTIFY_SEND",/);
  assert.equal(
    script.includes("NOTIFY_RESEND"),
    false,
    "🔴 배치가 수동 발송으로 적힌다",
  );
  assert.match(script, /actorName: "\(알림 배치\)",/);
});

test("🔴 한 통도 못 보내면 종료 코드가 1 이다 — 스케줄러가 실패를 알아야 한다", () => {
  assert.match(script, /if \(sent === 0\) process\.exitCode = 1;/);
  assert.match(script, /아무에게도 보내지 못했습니다\. npm run check-smtp/);
});

test("🔴 대상·받는 사람을 고르는 길이 그대로다 — 옮긴 것은 보내는 몸통뿐이다", () => {
  assert.match(
    script,
    /const \{ listNotifyTargets, notifyTargetYm \} = await import\("\.\.\/src\/lib\/notify"\);/,
  );
  assert.match(script, /listNotifyTargets\(ym\),\n\s*listActiveRecipients\(\),/);
  // 보내는 몸통은 화면과 **같은 것**을 쓴다. 두 벌로 적으면 한쪽만 고쳐진다.
  assert.match(
    script,
    /const \{ deliverNotifyMails, renderNotifyBodies \} = await import\(\s*"\.\.\/src\/lib\/notify-send",?\s*\);/,
  );
  // 로그는 그대로 남는다 — 스케줄러가 보는 것이 그 파일뿐이다.
  assert.match(script, /onLine: say,/);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3. 🔴 서버 액션 — 화면을 거치지 않고 불려도 막힌다
 * ═════════════════════════════════════════════════════════════════════════ */

test('🔴 서버 액션이다 — 파일 첫 줄이 "use server" 다', () => {
  assert.match(actionRaw, /^"use server";\n/);
});

test("🔴 관리자가 아니면 못 부른다 — 화면이 아니라 서버에서 막는다", () => {
  // 🔴 이 집의 권한 판정 함수를 그대로 쓴다. 새로 만들지 않는다.
  assert.match(resend, /const admin = await requireAdmin\(\);/);
  // 🔴 보내는 일보다 **앞**이어야 한다. 뒤에 있으면 막기 전에 메일이 나간다.
  const 검사 = resend.indexOf("requireAdmin()");
  const 발송 = resend.indexOf("deliverNotifyMails({");
  assert.ok(검사 > 0 && 발송 > 0);
  assert.ok(검사 < 발송, "🔴 권한 검사가 발송보다 뒤에 있다");
});

test("🔴 폼에서 온 값으로 무엇을 보낼지 정하지 않는다 — 받는 자리 자체가 없다", () => {
  // useActionState 는 앞선 상태와 폼 값을 넘기지만 이 함수는 받지 않는다.
  // 읽을 수 있는 자리가 없으면 잘못 읽을 수도 없다 — 폼 필드 하나로 아무
  // 기한이나 쏘는 통로가 생기지 않는다.
  assert.match(
    resend,
    /^export async function resendNotifyAction\(\): Promise<NotifyFormState> \{/,
  );
  assert.equal(
    /FormData|formData/.test(resend),
    false,
    "🔴 수동 발송이 폼 값을 읽는다",
  );
});

test("🔴 화면이 적은 것과 **같은 함수**로 대상을 고른다", () => {
  assert.match(resend, /const ym = nextNotifyYm\(\);/);
  assert.match(resend, /listNotifyTargets\(ym\),\n\s*listActiveRecipients\(\),/);
  // 화면도 같은 함수를 쓴다 — 둘이 어긋나면 메일이 나간 뒤에야 드러난다.
  assert.match(page, /const sampleYm = nextNotifyYm\(\);/);
  assert.match(page, /listNotifyTargets\(sampleYm\),/);
});

test("🔴 이미 보낸 기한이어도 보낸다 — 이것이 단추의 존재 이유다", () => {
  assert.equal(
    /alreadySent/.test(resend),
    false,
    "🔴 수동 발송이 '이미 보냈는가' 에 걸려 돌아간다 — 그러면 쓸 데가 없다",
  );
  // 반대로 배치는 그 검사를 그대로 가지고 있다(2절). 둘이 갈린 것이 맞다.
  assert.ok(script.includes("alreadySent(ym)"));
});

test("🔴 보낼 것이 없으면 메일 서버에 붙지 않는다 — 가드가 발송보다 앞이다", () => {
  assert.match(resend, /if \(meters\.length === 0\) \{/);
  assert.match(resend, /if \(recipients\.length === 0\) \{/);
  const 가드 = resend.indexOf("recipients.length === 0");
  const 붙는자리 = resend.indexOf("createTransport()");
  assert.ok(가드 > 0 && 붙는자리 > 0);
  assert.ok(가드 < 붙는자리, "🔴 보낼 것도 없는데 메일 서버에 붙는다");
});

test("🔴 같은 기한을 동시에 두 번 보내지 않는다 — 끝나면 반드시 자물쇠를 푼다", () => {
  assert.match(resend, /if \(sendingYms\.has\(ym\)\) \{/);
  assert.match(resend, /sendingYms\.add\(ym\);/);
  // finally 여야 한다. 중간에 터졌을 때 풀지 않으면 그 기한은 **영영** 못 보낸다.
  assert.match(resend, /\} finally \{\n\s*sendingYms\.delete\(ym\);\n\s*\}/);
});

test("🔴 web_notifications 에는 적지 않는다 — 처음 언제 나갔는지를 덮어쓰지 않는다", () => {
  // 그 표는 기한당 성공 기록 하나만 허락하는 자물쇠다(부분 유니크 인덱스).
  // 덮어쓰면 11-01 을 되짚은 근거가 사라지고, FAILED 로 적으면 거짓이 된다.
  assert.equal(
    /webNotifications/.test(resend),
    false,
    "🔴 수동 발송이 발송 기록 표를 건드린다",
  );
});

test("🔴 보내고 나면 감사 로그에 남는다 — 실패해도 남는다", () => {
  assert.match(resend, /action: "NOTIFY_RESEND",/);
  assert.match(resend, /actor: admin,/);
  assert.match(
    resend,
    /changes: \{\s*targetYm: ym,\s*meterCount: meters\.length,\s*sent,\s*failed: failures\.length,/,
  );
  // 🔴 적는 자리가 실패를 돌려주는 자리보다 **앞**이어야 한다. 뒤에 있으면
  //    전부 실패한 발송은 아무 데도 안 남는다 — 11-01 과 같은 추적 불가다.
  const 적는자리 = resend.indexOf("await writeAudit({");
  const 실패보고 = resend.indexOf("아무에게도 보내지 못했습니다");
  assert.ok(적는자리 > 0 && 실패보고 > 0);
  assert.ok(적는자리 < 실패보고, "🔴 전부 실패하면 기록이 안 남는다");
});

test("🔴 메일 서버에 못 붙어도 던지지 않는다 — 500 만 뜨면 아무것도 안 남는다", () => {
  const 보내는대목 = resend.slice(
    resend.indexOf("let sent = 0;"),
    resend.indexOf("await writeAudit({"),
  );
  assert.ok(보내는대목.length > 0);
  assert.match(보내는대목, /\} catch \(error\) \{/);
  assert.equal(/\bthrow\b/.test(resend), false, "🔴 수동 발송이 던진다");
});

test("🔴 결과를 말한다 — 몇 명에게 갔는지, 실패했으면 까닭까지", () => {
  assert.match(resend, /if \(sent === 0\) \{/);
  assert.match(resend, /error: `아무에게도 보내지 못했습니다/);
  assert.match(resend, /명에게 보냈습니다\./);
  assert.match(resend, /명은 실패했습니다/);
  assert.match(resend, /revalidatePath\("\/settings\/notify"\);/);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4. 🔴 화면 — 실수로 눌러도 바로 나가지 않는다
 * ═════════════════════════════════════════════════════════════════════════ */

test("🔴 관리자만 보는 화면 안에 있다", () => {
  assert.match(page, /if \(!isAdmin\(user\)\) notFound\(\);/);
  const 권한 = page.indexOf("if (!isAdmin(user)) notFound();");
  const 단추 = page.indexOf("<ResendNotifyForm");
  assert.ok(권한 > 0 && 단추 > 0 && 권한 < 단추);
});

test('🔴 단추는 클라이언트 조각이다 — 첫 토큰이 "use client" 다', () => {
  // 주석에 적힌 낱말이 아니라 **첫 토큰**으로 가린다.
  assert.match(withoutComments(formRaw).trimStart(), /^["']use client["']/);
});

test("🔴 한 번 눌러서 나가지 않는다 — 무엇이 몇 명에게 가는지 보여 주고 되묻는다", () => {
  // 첫 누름은 펼치기만 한다.
  assert.match(form, /onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(form, /\{!open \? \(/);
  // 펼친 판에 기한·대수·사람 수가 다 적혀 있다. 하나라도 빠지면 "무엇이
  // 나가는지" 를 모르는 채로 누르게 된다.
  assert.match(form, /누르면 지금 메일이 나갑니다/);
  assert.match(form, /\{ym\}<\/strong> 기한 계측기 <strong>\{meterCount\}대/);
  assert.match(form, /<strong>\{recipientCount\}명<\/strong>에게 보냅니다/);
  assert.match(form, /되돌릴 수\s*\n?\s*없습니다/);
  // 취소할 길이 있어야 한다.
  assert.match(form, /onClick=\{\(\) => setOpen\(false\)\}/);
});

test("🔴 보내는 동안 잠기고, 보내는 중임이 보인다", () => {
  assert.match(
    form,
    /useActionState<NotifyFormState, FormData>\(\s*resendNotifyAction,\s*\{\},?\s*\)/,
  );
  assert.match(form, /type="submit"\s*\n?\s*disabled=\{pending\}/);
  assert.match(form, /\{pending \? "보내는 중…"/);
  assert.match(form, /메일 서버에 붙는 데 10초쯤 걸립니다/);
  // 취소 단추도 잠근다 — 보내는 중에 닫아 버리면 결과를 못 본다.
  assert.equal(
    (form.match(/disabled=\{pending\}/g) ?? []).length,
    2,
    "🔴 보내는 중에 잠기는 단추 수가 달라졌다",
  );
});

test("🔴 보낼 것이 없으면 단추가 꺼지고 까닭이 적힌다 — 눌러도 아무 일 없는 단추를 두지 않는다", () => {
  assert.match(form, /meterCount === 0/);
  assert.match(form, /recipientCount === 0/);
  assert.match(form, /disabled=\{blocked !== null\}/);
  assert.match(form, /\{blocked && <span/);
});

test("🔴 이미 보낸 기한이면 **언제 보냈는지**가 단추 옆에 보인다", () => {
  // 위의 안내 문구("다음에 나갈 것은 …")는 이미 보냈는지를 보지 않는다.
  // 그 구멍을 여기서 메운다 — 없으면 같은 메일을 두 번 보내 놓고도 모른다.
  assert.match(form, /\{sentOn \? \(/);
  assert.match(form, /<strong className="text-slate-700">\{sentOn\}<\/strong>/);
  assert.match(form, /\{sentCount \?\? 0\}명에게 보낸 기록이 있습니다/);
  assert.match(form, /아직 보낸 기록이 없습니다/);
  // 화면이 그 값을 실제로 읽어 넘긴다.
  assert.match(page, /findSentNotification\(sampleYm\),/);
  assert.match(
    page,
    /<ResendNotifyForm\s+ym=\{sampleYm\}\s+meterCount=\{targets\.length\}\s+recipientCount=\{active\}\s+sentOn=\{lastSent\?\.sentOn \?\? null\}\s+sentCount=\{lastSent\?\.recipientCount \?\? null\}/,
  );
});

test("🔴 안내 문구와 단추가 같은 숫자를 쓴다 — 본 것과 나가는 것이 같다", () => {
  assert.match(
    page,
    /다음에 나갈 것은[\s\S]{0,200}\{sampleYm\} 기한 \{targets\.length\}[\s\S]{0,200}\{active\}명/,
  );
});

test("🔴 결과가 화면에 적힌다 — 성공도 실패도", () => {
  assert.match(form, /\{state\.error && \(/);
  assert.match(form, /\{state\.ok && \(/);
});

test("🔴 발송 기록 표가 두 자리를 합쳐 보여 준다 — 눌렀는데 표가 그대로면 또 누른다", () => {
  assert.match(page, /listManualResends\(\),/);
  assert.match(page, /label: r\.sent > 0 \? "재발송" : "재발송 실패",/);
  assert.match(page, /\.sort\(\(a, b\) => b\.at\.getTime\(\) - a\.at\.getTime\(\)\)/);
  // 🔴 감사 로그의 시각은 한국 시간 날짜로 읽는다. UTC 로 자르면 하루에 아홉
  //    시간 동안 하루 전으로 보인다.
  assert.match(page, /on: currentDate\(r\.at\),/);
});

/* ══════════════════════════════════════════════════════════════════════════
 * 5. 다음에 나갈 기한 — 화면과 단추가 함께 쓰는 셈
 * ═════════════════════════════════════════════════════════════════════════ */

test("1일이면 다음 달 기한, 1일이 아니어도 다음 달로 잡는다", async () => {
  const { nextNotifyYm, notifyTargetYm } = await import("./notify");

  assert.equal(nextNotifyYm("2026-11-01"), "2026-12");
  assert.equal(nextNotifyYm("2026-11-18"), "2026-12");
  // 해를 넘긴다.
  assert.equal(nextNotifyYm("2026-12-01"), "2027-01");
  assert.equal(nextNotifyYm("2026-12-31"), "2027-01");

  // 🔴 배치의 "오늘 보낼 것이 있는가" 는 그대로 null 을 돌려준다. 이 새 함수가
  //    그 판정을 덮어쓰면 1일이 아닌 날에도 자동 발송이 나간다.
  assert.equal(notifyTargetYm("2026-11-18"), null);
  assert.equal(notifyTargetYm("2026-11-01"), "2026-12");
});
