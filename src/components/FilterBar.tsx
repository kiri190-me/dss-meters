"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { ASSET_OWNERS, METER_STATUSES } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n";

type Props = {
  t: Dictionary;
  q: string;
  owner: string;
  status: string;
};

/**
 * 좁은 화면인가. Tailwind `md:`(min-width: 768px)의 **정확한 여집합**이라
 * 0.5px 틈이 생기지 않고, @dss/ui 가 메뉴 이름을 감추는 기준과도 같은 값이다.
 */
const NARROW = "not all and (min-width: 768px)";

function subscribeToWidth(onStoreChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

/**
 * 안내글(placeholder)은 글자라서 CSS 로 감추거나 줄일 수 없다 — 두 벌을 두고
 * 화면 폭으로 고른다. `useSyncExternalStore` 를 쓰는 이유는 둘이다:
 * 서버에서는 셋째 인자(넓은 화면)로 그려 서버·클라이언트가 어긋나지 않고,
 * effect 안에서 setState 를 부르지 않아 이 저장소의 lint 규칙에 걸리지 않는다.
 */
function useIsNarrow(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

export function FilterBar({ t, q, owner, status }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(q);
  const firstRender = useRef(true);

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "ALL") sp.delete(key);
      else sp.set(key, value);
    }
    const query = sp.toString();
    startTransition(() => router.replace(query ? `/?${query}` : "/"));
  }

  // 검색어는 타이핑이 멈춘 뒤에 반영한다.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => apply({ q: text }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const narrow = useIsNarrow();

  /*
    🔴 폰에서 `min-w-0 flex-1`, 768px 부터 `md:flex-none`.

    거르개 두 줄("자산"·"상태")의 **오른쪽 끝이 어긋나** 보이던 것을 고친다
    (2026-09-18 사용자 폰 사진). 선택칸은 제 목록 중 가장 긴 것에 맞춰 폭이
    정해지는데 「전체 / DSS 자산 / 교산 자산」과 「… / 기한초과(사용금지) / …」는
    길이가 달라(80px 대 120px) 줄마다 끝이 다른 데서 끝났다. 아래 라벨에
    `w-full` 을 걸어 각 줄이 같은 폭을 쓰게 하고, 선택칸이 그 줄의 남는 자리를
    **다 채우게** 하면 두 줄의 왼쪽·오른쪽 끝이 모두 맞는다. 라벨 글자("자산"·
    "상태")가 두 언어 모두 두 글자라 왼쪽도 저절로 맞는다.

    `min-w-0` 이 없으면 선택칸이 제 가장 긴 항목 폭 밑으로 줄지 못해 줄을
    넘긴다. 768px 부터는 `md:w-auto`·`md:flex-none` 으로 지금까지의 모습
    그대로(내용에 맞는 폭)로 돌아간다.
  */
  const selectClass =
    "min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none md:flex-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          narrow ? t.list.searchPlaceholderShort : t.list.searchPlaceholder
        }
        className="min-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />

      {/*
        🔴 `whitespace-nowrap` — 라벨 글자는 이 줄의 익명 flex 항목이라, 폰에서
        자리가 모자라면 flex 가 min-content 까지 눌러 "상 / 태" 처럼 **한 글자씩
        세로로** 끊어 놓았다(2026-09-18 사용자 폰 사진). 글자를 온전히 두고,
        모자라면 바깥 flex-wrap 이 줄을 바꾸게 한다.
      */}
      <label className="flex w-full items-center gap-1.5 text-sm whitespace-nowrap text-slate-500 md:w-auto">
        {t.list.owner}
        <select
          value={owner}
          onChange={(e) => apply({ owner: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">{t.common.all}</option>
          {ASSET_OWNERS.map((value) => (
            <option key={value} value={value}>
              {t.owner[value]}
            </option>
          ))}
        </select>
      </label>

      {/* 위와 같은 이유. 사진에서 실제로 끊긴 것이 이쪽이다("상 / 태"). */}
      <label className="flex w-full items-center gap-1.5 text-sm whitespace-nowrap text-slate-500 md:w-auto">
        {t.list.status}
        <select
          value={status}
          onChange={(e) => apply({ status: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">{t.common.all}</option>
          {METER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t.status[value]}
            </option>
          ))}
        </select>
      </label>

      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full transition-opacity ${
          pending ? "bg-slate-400 opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
