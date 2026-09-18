"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ASSET_OWNERS, METER_STATUSES } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n";

type Props = {
  t: Dictionary;
  q: string;
  owner: string;
  status: string;
};

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

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.list.searchPlaceholder}
        className="min-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />

      {/*
        🔴 `whitespace-nowrap` — 라벨 글자는 이 줄의 익명 flex 항목이라, 폰에서
        자리가 모자라면 flex 가 min-content 까지 눌러 "상 / 태" 처럼 **한 글자씩
        세로로** 끊어 놓았다(2026-09-18 사용자 폰 사진). 글자를 온전히 두고,
        모자라면 바깥 flex-wrap 이 줄을 바꾸게 한다.
      */}
      <label className="flex items-center gap-1.5 text-sm whitespace-nowrap text-slate-500">
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
      <label className="flex items-center gap-1.5 text-sm whitespace-nowrap text-slate-500">
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
