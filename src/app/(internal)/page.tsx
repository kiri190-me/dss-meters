import Link from "next/link";

import { FilterBar } from "@/components/FilterBar";
import { PrintButton } from "@/components/PrintButton";
import { StatusBadge } from "@/components/StatusBadge";
import { getSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/guards";
import {
  ASSET_OWNERS,
  METER_STATUSES,
  type AssetOwner,
  type MeterStatus,
} from "@/lib/db/schema";
import {
  countUnassignedCertificates,
  meterIdsWithCertificates,
} from "@/lib/calibrations";
import { getDictionary, meterName } from "@/lib/i18n";
import {
  currentDate,
  currentYm,
  describeFilter,
  dueLevel,
  listMeters,
  parseDir,
  parseSort,
  summarize,
  type SortDir,
  type SortKey,
} from "@/lib/meters";

/** 목록 행의 배경색 — 상태가 아니라 교정기한으로 정한다. */
const ROW_STYLE = {
  OVERDUE: "bg-red-50 hover:bg-red-100/70",
  SOON: "bg-amber-50 hover:bg-amber-100/70",
  OK: "bg-white hover:bg-slate-50",
  NONE: "bg-white text-slate-400 hover:bg-slate-50",
} as const;

const DUE_STYLE = {
  OVERDUE: "font-semibold text-red-700",
  SOON: "font-semibold text-amber-700",
  OK: "text-slate-700",
  NONE: "text-slate-400",
} as const;

const TH =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500";
const TD = "whitespace-nowrap px-3 py-2 text-sm";

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | "ALL" {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : "ALL";
}

/**
 * 정렬 가능한 표 머리글.
 * 지금 정렬 중인 열은 진한 화살표(▲ 오름 / ▼ 내림), 나머지는 흐린 ▼ 로 표시한다.
 */
function SortHeader({
  label,
  column,
  sort,
  dir,
  base,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: SortKey;
  dir: SortDir;
  base: URLSearchParams;
  align?: "left" | "right";
}) {
  const active = sort === column;
  const nextDir: SortDir = active && dir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(base);
  params.set("sort", column);
  params.set("dir", nextDir);

  return (
    <th className={`${TH} ${align === "right" ? "text-right" : ""}`}>
      <Link
        href={`/?${params.toString()}`}
        scroll={false}
        className={`group inline-flex items-center gap-1 hover:text-slate-900 ${
          active ? "text-slate-900" : ""
        }`}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span
          aria-hidden
          className={`text-[0.65rem] leading-none print:hidden ${
            active ? "text-slate-900" : "text-slate-300 group-hover:text-slate-500"
          }`}
        >
          {active && dir === "asc" ? "▲" : "▼"}
        </span>
      </Link>
    </th>
  );
}

export default async function MeterListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { lang, t } = await getDictionary();
  const user = await getSessionUser();

  const str = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : undefined;

  const q = str("q") ?? "";
  const owner = pick<AssetOwner>(str("owner"), ASSET_OWNERS);
  const status = pick<MeterStatus>(str("status"), METER_STATUSES);
  const sort = parseSort(str("sort"));
  const dir = parseDir(str("dir"));

  // 정렬 링크가 검색·필터 조건을 잃어버리지 않게 한다.
  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (owner !== "ALL") base.set("owner", owner);
  if (status !== "ALL") base.set("status", status);

  const filter = { q, owner, status };
  const meters = await listMeters(filter, { key: sort, dir }, lang);
  const summary = await summarize(meters);
  const today = currentYm();

  const admin = isAdmin(user);
  const [withCerts, unassigned] = await Promise.all([
    meterIdsWithCertificates(),
    admin ? countUnassignedCertificates() : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-4">
      {/* 종이에만 나온다. 그 종이만 보고도 무엇을 뽑은 것인지 알 수 있게. */}
      <div className="print-only mb-3">
        <h1 className="text-lg font-semibold text-slate-900">
          {t.list.printTitle}
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {describeFilter(filter, t)}
        </p>
        <p className="text-xs text-slate-500">
          {t.list.total} {meters.length}
          {t.common.unit} · {currentDate()}
        </p>
      </div>

      {/*
        한 줄 요약.

        🔴 세로 폰(<640px)에서는 **2칸 격자**, 640px 부터는 예전 그대로 한 줄
        `flex`(2026-09-18 사용자 폰 사진). 왜 둘로 나뉘는가:

        예전에는 폭에 관계없이 `flex flex-wrap` 하나였는데, 폰에서는 넷이 한
        줄에 안 들어가 제멋대로 접혔다. 접히는 자리가 통계 **사이**가 아니라
        구분점 뒤라서 「전체 76대 · 기한초과 11 ·」처럼 **줄 끝에 점만 덩그러니**
        남았고(아래 구분점 주석), 줄마다 글자 수가 달라 세로로도 안 맞았다.

        격자로 두면 넷이 2×2 로 **칸이 맞고**, 접히는 자리를 flex 가 마음대로
        고르지 않는다. 그리고 구분점이 필요 없어진다 — 칸이 이미 갈라 준다.

        640px 부터는 `sm:flex sm:flex-wrap` 이 `display:grid` 를 덮으므로
        `grid-cols-2` 는 아무 일도 하지 않는다. 넓은 화면은 한 픽셀도 달라지지
        않는다.

        🔴 기준점이 `md`(768)가 아니라 `sm`(640)인 이유: 이것은 **글자를
        줄이는** 판단(머리말의 짧은 이름 · 검색 안내글 — 그쪽은 @dss/ui 의
        768px 과 맞춰야 한다)이 아니라 **쌓는** 판단이다. 가로로 돌린 폰이
        640〜768px 에 들어오는데(SE 667 · 8 Plus 736), 거기서는 넷이 한 줄에
        넉넉히 들어간다 — `md` 로 두면 그 폭까지 세 줄로 쪼개 예전보다
        나빠진다.
      */}
      <div className="no-print grid grid-cols-2 items-center gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm sm:flex sm:flex-wrap">
        <span className="text-slate-700">
          {t.list.total}{" "}
          <strong className="tabular text-base text-slate-900">
            {summary.total}
          </strong>
          {t.common.unit}
        </span>
        {/*
          🔴 구분점은 **세로 폰에서 끈다**(`hidden sm:inline`).

          이것은 독립된 칸이라 줄이 바뀔 때 앞 통계와 함께 가지 않고 **홀로
          줄 끝에 남았다.** 뒤 통계에 붙여 두면 이번엔 다음 줄이 점으로 시작해
          마찬가지로 어색하다. 폰에서는 위 격자가 이미 칸을 갈라 주므로 점이
          할 일이 없다 — 지우는 것이 가장 깨끗하다.

          `hidden`(display:none)이라 격자 칸도 차지하지 않는다. 뜻이 아니라
          **장식**이라(앞뒤 글자가 이미 무엇인지 말한다) 낭독기에서 사라져도
          잃는 것이 없다. 640px 부터는 `sm:inline` 으로 예전 그대로 돌아온다.
        */}
        <span className="hidden text-slate-300 sm:inline">·</span>
        <span className={summary.overdue > 0 ? "text-red-700" : "text-slate-400"}>
          {t.list.overdue} <strong className="tabular">{summary.overdue}</strong>
        </span>
        <span className="hidden text-slate-300 sm:inline">·</span>
        <span className={summary.soon > 0 ? "text-amber-700" : "text-slate-400"}>
          {t.list.soon} <strong className="tabular">{summary.soon}</strong>
        </span>
        <span className="hidden text-slate-300 sm:inline">·</span>
        <span
          className={summary.calibrating > 0 ? "text-sky-700" : "text-slate-400"}
        >
          {t.list.calibrating}{" "}
          <strong className="tabular">{summary.calibrating}</strong>
        </span>

        {/*
          단추 둘을 한 묶음으로 싼다.

          🔴 폰: `col-span-2` 로 격자의 **두 칸을 다 써** 제 줄을 갖고, 안에서
          `flex-1` 로 둘이 폭을 반씩 나눠 가진다. `py-3` 은 손가락 크기다
          (16 + 12 + 12 = 40px — 예전 `py-1.5` 로는 28px 이라 폰에서 눌리지
          않았다). 통계는 왼쪽, 단추는 오른쪽이던 **줄마다 다른 정렬**이
          사라지고 단추 줄이 폭을 꽉 채운다.

          🔴 640px 부터: `sm:ml-auto` 로 이 묶음이 오른쪽 끝으로 가고
          `sm:gap-x-5` 가 예전 바깥 `gap-x-5`(20px)를 그대로 잇고
          `sm:flex-none`·`sm:py-1.5` 로 단추가 제 내용 폭·예전 높이로 돌아온다.
          예전에는 `ml-auto` 가 단추 자신에게 붙어 있었는데(미등록이 없으면
          등록 단추로 옮겨 다녔다), 묶음이 그 일을 대신 맡아 그 조건 분기도
          사라졌다. 그려지는 자리는 같다.

          `text-center` 는 폰에서만 뜻이 있다 — 640px 부터는 `flex-none` 이라
          글자 폭만큼만 차지해 가운데 맞출 자리가 없다.
        */}
        {admin && (
          <div className="col-span-2 mt-1.5 flex items-center gap-2 sm:mt-0 sm:ml-auto sm:gap-x-5">
            {unassigned > 0 && (
              <Link
                href="/certificates"
                className="flex-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-center text-xs font-medium text-amber-800 hover:bg-amber-100 sm:flex-none sm:py-1.5"
              >
                {t.cert.unassigned} {unassigned}
              </Link>
            )}

            <Link
              href="/meters/new"
              className="flex-1 rounded-md bg-slate-900 px-3 py-3 text-center text-xs font-medium text-white hover:bg-slate-700 sm:flex-none sm:py-1.5"
            >
              + {t.list.add}
            </Link>
          </div>
        )}
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        {/*
          🔴 세로 폰(<640px)에서는 거르개가 **제 줄을 통째로** 쓴다(`w-full`),
          640px 부터는 예전처럼 남는 자리만 쓴다(`sm:min-w-0 sm:flex-1`).
          기준점을 `sm` 으로 둔 까닭은 위 현황판 주석과 같다 — 가로로 돌린
          폰까지 한 줄 더 쓰게 만들 이유가 없다.

          예전에는 폭에 관계없이 `min-w-0 flex-1` 이라 기준 폭이 0 이었다.
          그래서 폰에서도 엑셀·인쇄 단추와 **같은 줄**에 놓였고, 거르개 상자가
          남는 127px 만 받은 채 안에서 세 줄(검색·자산·상태)로 접혔다. 단추
          둘은 그 세 줄의 **가운데 높이**에 떠서 「자산」 줄 옆에만 붙어 보였고
          (사용자 폰 사진), 「상태」 줄 오른쪽은 비었다. 게다가 검색칸은
          `min-w-[16rem]`(256px)이라 127px 상자를 **삐져나가** 있었다.

          `w-full` 이면 거르개가 328px 을 다 쓰고 단추 둘이 아래 줄로 내려간다.
          검색칸도 삐져나가지 않고, 선택칸이 넓어져 손가락으로 고르기 쉽다.
        */}
        <div className="w-full sm:w-auto sm:min-w-0 sm:flex-1">
          <FilterBar t={t} q={q} owner={owner} status={status} />
        </div>
        {sort !== "priority" && (
          <Link
            href={base.toString() ? `/?${base.toString()}` : "/"}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            ↺ {t.list.defaultSort}
          </Link>
        )}

        {/* 화면에서 보고 있는 조건 그대로 내려받는다. 정렬은 문서 쪽 규칙을 따른다. */}
        <a
          href={`/api/meters/export${base.toString() ? `?${base.toString()}` : ""}`}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          ↓ {t.list.exportExcel}
        </a>

        <PrintButton t={t} />
      </div>

      <div className="print-table overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <SortHeader
                label={t.field.assetNo}
                column="assetNo"
                sort={sort}
                dir={dir}
                base={base}
              />
              <SortHeader
                label={t.field.name}
                column="name"
                sort={sort}
                dir={dir}
                base={base}
              />
              <SortHeader
                label={t.field.maker}
                column="maker"
                sort={sort}
                dir={dir}
                base={base}
              />
              <SortHeader
                label={t.field.model}
                column="model"
                sort={sort}
                dir={dir}
                base={base}
              />
              {/* 전체로 뽑으면 DSS 것과 교산 것이 섞인다. 종이에서는 구분이 필요하다. */}
              <th className={`${TH} hidden print:table-cell`}>
                {t.field.assetOwner}
              </th>
              <SortHeader
                label={t.field.controlNo}
                column="controlNo"
                sort={sort}
                dir={dir}
                base={base}
              />
              <SortHeader
                label={t.field.calibrationDueYm}
                column="due"
                sort={sort}
                dir={dir}
                base={base}
              />
              <th className={`${TH} text-right`}>{t.field.quantity}</th>
              <th className={TH}>{t.field.serialNo}</th>
              <SortHeader
                label={t.field.status}
                column="status"
                sort={sort}
                dir={dir}
                base={base}
              />
              <th className={TH}>{t.field.note}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {meters.map((meter) => {
              const level = dueLevel(meter, today);
              return (
                <tr key={meter.id} className={ROW_STYLE[level]}>
                  <td className={`${TD} tabular font-medium`}>
                    <Link
                      href={`/meters/${meter.id}`}
                      className="text-slate-900 underline-offset-2 hover:underline"
                    >
                      {meter.assetNo}
                    </Link>
                  </td>
                  <td className={`${TD} max-w-[22rem] truncate`}>
                    <Link
                      href={`/meters/${meter.id}`}
                      className="hover:underline"
                      title={meterName(lang, meter)}
                    >
                      {meterName(lang, meter)}
                    </Link>
                    {withCerts.has(meter.id) && (
                      <span className="ml-1.5 text-xs" title={t.cert.title}>
                        📄
                      </span>
                    )}
                  </td>
                  <td className={TD}>{meter.maker ?? t.common.none}</td>
                  <td
                    className={`${TD} max-w-[14rem] truncate`}
                    title={meter.model ?? ""}
                  >
                    {meter.model ?? t.common.none}
                  </td>
                  <td
                    className={`${TD} print-owner hidden text-slate-500 print:table-cell`}
                  >
                    {t.owner[meter.assetOwner]}
                  </td>
                  <td className={`${TD} tabular text-slate-500`}>
                    {meter.controlNo ?? t.common.none}
                  </td>
                  <td className={`${TD} tabular ${DUE_STYLE[level]}`}>
                    {meter.calibrationDueYm ?? t.common.none}
                    {level === "OVERDUE" && (
                      <span className="ml-1.5 text-xs">({t.due.overdue})</span>
                    )}
                    {level === "SOON" && (
                      <span className="ml-1.5 text-xs">({t.due.soon})</span>
                    )}
                  </td>
                  <td className={`${TD} tabular text-right`}>{meter.quantity}</td>
                  <td className={`${TD} tabular text-slate-500`}>
                    {meter.serialNo ?? t.common.none}
                  </td>
                  <td className={TD}>
                    <StatusBadge status={meter.status} t={t} />
                  </td>
                  <td
                    className={`${TD} max-w-[16rem] truncate text-slate-500`}
                    title={meter.note ?? ""}
                  >
                    {meter.note ?? ""}
                  </td>
                </tr>
              );
            })}

            {meters.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-10 text-center text-sm text-slate-400"
                >
                  {t.list.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
