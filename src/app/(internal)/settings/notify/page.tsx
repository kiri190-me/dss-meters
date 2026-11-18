import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteRecipientAction,
  toggleRecipientAction,
} from "@/app/actions/notify";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MailTemplateForm } from "@/components/MailTemplateForm";
import { RecipientForm } from "@/components/RecipientForm";
import { ResendNotifyForm } from "@/components/ResendNotifyForm";
import { isAdmin } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getDictionary, LANGUAGE_LABEL, LANGUAGES } from "@/lib/i18n";
import { loadTemplate } from "@/lib/mail/notify-mail";
import { currentDate } from "@/lib/meters";
import {
  findSentNotification,
  listManualResends,
  listNotifications,
  listRecipients,
} from "@/lib/notify-admin";
import { listNotifyTargets, nextNotifyYm } from "@/lib/notify";

const CARD = "rounded-lg border border-slate-200 bg-white";
const CARD_HEAD =
  "flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3";

const TH =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500";
const TD = "whitespace-nowrap px-3 py-2 text-sm";

const BADGE = "rounded-full px-2 py-0.5 text-xs font-medium";

/**
 * 발송 기록 한 줄. **두 자리**에서 온다 —
 * 배치가 적는 `web_notifications` 와, 수동 발송이 적는 감사 로그.
 *
 * 🔴 수동 발송을 `web_notifications` 에 못 적는 까닭은
 * `app/actions/notify.ts` 의 `resendNotifyAction` 주석에 있다(그 표는 기한당
 * 성공 기록 하나만 허락하는 자물쇠다). 그래서 표가 배치 기록만 보여 주면
 * 다시 보내기를 누른 사람 눈에는 아무 일도 안 일어난 것처럼 보이고, 또 누른다.
 */
type HistoryRow = {
  key: string;
  /** 줄을 세우는 기준. 두 자리에서 온 줄을 한 차례로 섞는다. */
  at: Date;
  on: string;
  ym: string;
  meters: number;
  people: number;
  label: string;
  tone: string;
  note: string;
};

/**
 * 교정 기한 알림 설정.
 *
 * 관리자만 본다. 여기서 정하는 것은 세 가지다 —
 * 누가 받을지, 어떤 말로 보낼지, 지금까지 무엇이 나갔는지.
 */
export default async function NotifySettingsPage() {
  const { lang, t } = await getDictionary();
  const user = await getSessionUser();
  if (!isAdmin(user)) notFound();

  // 미리보기용 숫자. 오늘이 1일이 아니어도 감이 오도록 다음 달을 쓴다.
  // 🔴 수동 발송 단추가 **같은 함수**로 기한을 정한다 — 여기 적힌 것과 실제로
  //    나가는 것이 어긋나면 메일이 나간 뒤에야 드러난다.
  const sampleYm = nextNotifyYm();

  const [recipients, history, resends, lastSent, targets, koTemplate, jaTemplate] =
    await Promise.all([
      listRecipients(),
      listNotifications(),
      listManualResends(),
      findSentNotification(sampleYm),
      listNotifyTargets(sampleYm),
      loadTemplate("ko"),
      loadTemplate("ja"),
    ]);

  const templates = { ko: koTemplate, ja: jaTemplate };
  const active = recipients.filter((r) => r.isActive).length;

  const rows: HistoryRow[] = [
    ...history.map((h) => ({
      key: h.id,
      at: h.createdAt,
      on: h.sentOn,
      ym: h.targetYm,
      meters: h.meterCount,
      people: h.recipientCount,
      label: h.result === "SENT" ? "보냄" : "실패",
      tone:
        h.result === "SENT"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-red-100 text-red-800",
      note: h.error ?? formatDateTime(h.createdAt, lang),
    })),
    ...resends.map((r) => ({
      key: r.id,
      at: r.at,
      // 감사 로그에는 "보낸 날" 칸이 따로 없다. 적힌 시각을 한국 시간의
      // 날짜로 읽는다 — UTC 로 자르면 아홉 시간 동안 하루 전으로 보인다.
      on: currentDate(r.at),
      ym: r.targetYm,
      meters: r.meterCount,
      people: r.sent,
      label: r.sent > 0 ? "재발송" : "재발송 실패",
      tone:
        r.sent > 0
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-800",
      note: r.error
        ? `${r.actorName} — ${r.error}`
        : `${r.actorName} · ${formatDateTime(r.at, lang)}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          ← {t.common.back}
        </Link>
      </div>

      {/* 언제 무엇이 나가는지 */}
      <div className={`${CARD} px-5 py-4`}>
        <h1 className="text-lg font-semibold text-slate-900">교정 기한 알림</h1>
        <p className="mt-1 text-sm text-slate-600">
          교정 기한이 <strong>다음 달</strong>인 계측기를 매달{" "}
          <strong>1일</strong>에 메일로 알립니다. 기한이 닥쳐서 알리면 교정을 보낼
          시간이 없기 때문입니다.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          지금 기준으로 다음에 나갈 것은{" "}
          <strong className="text-slate-900">
            {sampleYm} 기한 {targets.length}
            {t.common.unit}
          </strong>
          , 받는 사람은 <strong className="text-slate-900">{active}명</strong>
          입니다.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          교정대상아님 · 고장(교정불가) · 반납·발송 · 교정진행중 상태는 알리지
          않습니다.
        </p>

        {/* 1일에 나갔어야 했던 메일을 지금 다시 보내는 자리.
            위 문구가 말하는 바로 그 대상이 그대로 나간다. */}
        <ResendNotifyForm
          ym={sampleYm}
          meterCount={targets.length}
          recipientCount={active}
          sentOn={lastSent?.sentOn ?? null}
          sentCount={lastSent?.recipientCount ?? null}
        />
      </div>

      {/* 받는 사람 */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <h2 className="text-base font-semibold text-slate-900">받는 사람</h2>
          <span className="tabular text-sm text-slate-400">
            {recipients.length}
          </span>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <RecipientForm />
        </div>

        {recipients.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            받는 사람이 없습니다. 한 명도 없으면 메일이 나가지 않습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={TH}>메일 주소</th>
                  <th className={TH}>이름</th>
                  <th className={TH}>메일 언어</th>
                  <th className={TH}>받기</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipients.map((r) => (
                  <tr key={r.id} className={r.isActive ? "" : "bg-slate-50"}>
                    <td className={`${TD} text-slate-900`}>{r.email}</td>
                    <td className={`${TD} text-slate-600`}>
                      {r.name ?? t.common.none}
                    </td>
                    <td className={`${TD} text-slate-600`}>
                      {LANGUAGE_LABEL[r.lang as "ko" | "ja"] ?? r.lang}
                    </td>
                    <td className={TD}>
                      {/* 지우지 않고 잠시 끄고 켜는 자리 */}
                      <form action={toggleRecipientAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            r.isActive
                              ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                              : "bg-slate-200 text-slate-500 ring-slate-300"
                          }`}
                        >
                          {r.isActive ? "받음" : "받지 않음"}
                        </button>
                      </form>
                    </td>
                    <td className={`${TD} text-right`}>
                      <form action={deleteRecipientAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton
                          message={`${r.email}\n\n${t.common.delete}?`}
                          className="text-xs text-slate-400 hover:text-red-600"
                        >
                          {t.common.delete}
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 메일 문구 */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <h2 className="text-base font-semibold text-slate-900">메일 문구</h2>
          <span className="text-xs text-slate-400">
            계측기 표는 자동으로 붙습니다. 여기서는 말만 고칩니다.
          </span>
        </div>
        <div className="grid gap-8 px-5 py-4 lg:grid-cols-2">
          {LANGUAGES.map((l) => (
            <MailTemplateForm
              key={l}
              lang={l}
              langLabel={LANGUAGE_LABEL[l]}
              template={templates[l]}
              sampleYm={sampleYm}
              sampleCount={targets.length}
            />
          ))}
        </div>
      </div>

      {/* 발송 기록 */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <h2 className="text-base font-semibold text-slate-900">발송 기록</h2>
          <span className="tabular text-sm text-slate-400">{rows.length}</span>
          <span className="text-xs text-slate-400">
            배치가 보낸 것과 손으로 다시 보낸 것을 함께 보여 줍니다.
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            아직 보낸 적이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={TH}>보낸 날</th>
                  <th className={TH}>대상 기한</th>
                  <th className={TH}>계측기</th>
                  <th className={TH}>받은 사람</th>
                  <th className={TH}>결과</th>
                  <th className={TH}>비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className={`${TD} tabular text-slate-900`}>{row.on}</td>
                    <td className={`${TD} tabular text-slate-700`}>{row.ym}</td>
                    <td className={`${TD} tabular text-slate-600`}>
                      {row.meters}
                      {t.common.unit}
                    </td>
                    <td className={`${TD} tabular text-slate-600`}>
                      {row.people}명
                    </td>
                    <td className={TD}>
                      <span className={`${BADGE} ${row.tone}`}>{row.label}</span>
                    </td>
                    <td
                      className={`${TD} max-w-[22rem] truncate text-slate-500`}
                      title={row.note}
                    >
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
