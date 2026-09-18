import type { ko } from "./ko";

/** 한국어 사전이 기준. 일본어 사전은 이 구조를 그대로 채워야 한다. */
export type Dictionary = {
  -readonly [K in keyof typeof ko]: {
    -readonly [P in keyof (typeof ko)[K]]: string;
  };
};

export const LANGUAGES = ["ko", "ja"] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_LABEL: Record<Lang, string> = {
  ko: "한국어",
  ja: "日本語",
};

/**
 * 좁은 화면(<768px)에서 대신 보이는 한 글자.
 *
 * 🔴 두 글자 다 **제 언어를 쓰는 사람이 제 언어를 알아보는** 글자다: 한국인은
 * "한"(한국어), 일본인은 "日"(日本語 첫 글자이자 일본어를 가리키는 흔한 줄임)을
 * 본다. 어느 쪽도 상대 언어를 읽을 줄 몰라도 제 칸을 찾을 수 있어야 해서
 * "KO/JA" 같은 로마자 대신 이렇게 둔다.
 *
 * 🔴 줄이는 것은 **눈에서만**이다 — 긴 이름은 sr-only 로 마크업에 그대로 남아
 * 화면 낭독기는 여전히 "한국어"·"日本語" 로 읽는다(LanguageSwitch.tsx).
 */
export const LANGUAGE_SHORT: Record<Lang, string> = {
  ko: "한",
  ja: "日",
};
