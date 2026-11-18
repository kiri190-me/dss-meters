"use client";

import { useActionState, useState } from "react";

import { resendNotifyAction, type NotifyFormState } from "@/app/actions/notify";

/**
 * 1일에 나갔어야 했던 메일을 지금 다시 보내는 단추.
 *
 * 🔴 2026-11-01 에 배치는 "3명에게 보냈습니다" 로 끝났고 발송 기록에도 보냄으로
 * 적혔는데, 아무도 받지 못했다(보내는 주소의 도메인 오타 — 자세한 것은
 * `app/actions/notify.ts` 의 `resendNotifyAction`). 그런 일이 또 생겼을 때
 * NAS 에 SSH 로 붙지 않고 여기서 다시 보낸다.
 *
 * 여기서 지키는 것 셋:
 *  1. 🔴 한 번 눌러서 나가지 않는다. 무엇이 몇 명에게 나가는지 펼쳐 보이고 한
 *     번 더 묻는다 — 받는 사람은 실제 직원이고 메일은 되돌릴 수 없다.
 *     (지우기 단추의 `window.confirm` 대신 펼침 판을 쓰는 것은, 묻는 자리에
 *     "기한 · 대수 · 사람 수" 를 다 적어야 하기 때문이다. 계측기 삭제도
 *     같은 방식이다 — `DeleteMeterForm`.)
 *  2. 🔴 보내는 동안 단추가 잠긴다. 메일 서버(cafe24)에 붙는 데만 10초쯤
 *     걸려서, 잠그지 않으면 "안 눌렸나" 하고 또 누른다. 서버도 같은 기한을
 *     동시에 두 번 보내지 않도록 한 번 더 막는다.
 *  3. 🔴 끝나면 결과를 글로 말한다. 몇 명에게 갔는지, 실패했으면 까닭까지.
 *     조용히 끝내면 11-01 과 같은 일이 반복된다 — "보냈다는데 안 왔다".
 *
 * 🔴 보낼 것이 없으면(계측기 0대 · 받는 사람 0명) 단추를 꺼 두고 까닭을 적는다.
 * 눌러도 아무 일 없는 단추를 두지 않는다. 막는 것은 서버 액션도 다시 한다.
 */
export function ResendNotifyForm({
  ym,
  meterCount,
  recipientCount,
  sentOn,
  sentCount,
}: {
  /** 지금 누르면 나갈 기한. 안내 문구와 **같은 함수**에서 나온 값이다. */
  ym: string;
  meterCount: number;
  recipientCount: number;
  /** 그 기한을 보낸 날(YYYY-MM-DD). 보낸 적이 없으면 null. */
  sentOn: string | null;
  sentCount: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<NotifyFormState, FormData>(
    resendNotifyAction,
    {},
  );

  // 눌러도 아무 일이 없을 때는 아예 못 누르게 하고, 그 까닭을 옆에 적는다.
  const blocked =
    meterCount === 0
      ? `${ym} 기한인 계측기가 없어 보낼 것이 없습니다.`
      : recipientCount === 0
        ? "받는 사람이 없습니다. 위에서 먼저 등록하세요."
        : null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {/* 🔴 위의 안내 문구("다음에 나갈 것은 …")는 이미 보냈는지를 보지 않는다.
          그 사실을 여기서 채운다 — 지금 누르면 무엇이 되풀이되는지 알아야 한다. */}
      <p className="text-xs text-slate-500">
        {sentOn ? (
          <>
            {ym} 기한은 <strong className="text-slate-700">{sentOn}</strong> 에{" "}
            {sentCount ?? 0}명에게 보낸 기록이 있습니다. 받지 못했다면 여기서 다시
            보냅니다.
          </>
        ) : (
          <>{ym} 기한은 아직 보낸 기록이 없습니다.</>
        )}
      </p>

      {!open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={blocked !== null}
            onClick={() => setOpen(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
          >
            지금 다시 보내기
          </button>
          {blocked && <span className="text-xs text-slate-400">{blocked}</span>}
        </div>
      ) : (
        <form
          action={formAction}
          className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3"
        >
          <p className="text-sm font-medium text-amber-900">
            누르면 지금 메일이 나갑니다
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            <strong>{ym}</strong> 기한 계측기 <strong>{meterCount}대</strong>를{" "}
            <strong>{recipientCount}명</strong>에게 보냅니다. 보낸 메일은 되돌릴 수
            없습니다.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-amber-300"
            >
              {pending ? "보내는 중…" : `${recipientCount}명에게 보냅니다`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:text-slate-300"
            >
              취소
            </button>
            {pending && (
              <span className="text-xs text-amber-700">
                메일 서버에 붙는 데 10초쯤 걸립니다. 창을 닫지 마세요.
              </span>
            )}
          </div>
        </form>
      )}

      {state.error && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
          {state.ok}
        </p>
      )}
    </div>
  );
}
