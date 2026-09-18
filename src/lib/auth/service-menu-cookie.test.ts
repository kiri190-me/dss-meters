/**
 * ============================================================================
 * 서비스 메뉴바 목록을 나르는 별도 서명 쿠키
 * ============================================================================
 * 담긴 것은 인가 자료가 아니라 「그릴 목록」이다. 그래서 이 파일이 못 박는
 * 것도 넷뿐이다:
 *
 *  1. 포털이 목록을 안 보내면(아직 배포 전이다) 쿠키를 굽지 않는다 —
 *     로그인은 예전과 똑같이 끝나고 띠도 안 그려진다.
 *  2. 보내면 굽고, 그 쿠키는 **서명되어 있다** — 위조·변조·만료는 전부
 *     빈 목록이지 예외가 아니다(띠 때문에 본문이 죽어서는 안 된다).
 *  3. 로그인 왕복 쿠키와 비밀값을 같이 쓰지만 **용도가 갈린다** — 한쪽 값을
 *     다른 쪽에 옮겨 넣으면 거절된다.
 *  4. 서명이 맞아도 안의 값은 다시 거른다.
 * ============================================================================
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { sealSigned, sealTransaction } from "./oidc";
import {
  SERVICE_MENU_COOKIE_NAME,
  createServiceMenuToken,
  parseServiceMenuToken,
  serviceMenuMaxAgeSeconds,
} from "./service-menu-cookie";

// env 는 쓰는 시점에 읽는 getter 라(lib/env.ts), 첫 호출 전에 여기서 넣어
// 두면 충분하다 — 모듈 적재 순서에 매이지 않는다. 32자 이상이어야 한다.
process.env.SSO_TX_SECRET = "test-only-secret-for-unit-tests-0123456789";

const SERVICES = [
  { id: "rf-service-system", name: "A/S 관리", url: "http://10.0.0.5:3000", icon: "🔧" },
  { id: "dss-meters", name: "계측기 관리", url: "http://10.0.0.5:3300" },
];

const PURPOSE = "service-menu";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function payloadOf(token: string): { issuedAt: number; expiresAt: number } {
  return JSON.parse(
    Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
  ) as { issuedAt: number; expiresAt: number };
}

test("쿠키 이름은 이 사이트 것이다 — 같은 호스트의 다른 포트와 겹치지 않는다", () => {
  // 쿠키는 포트를 가리지 않는다. 포털·A/S·계측기가 같은 호스트에 뜨므로
  // 이름이 겹치면 한쪽 로그인이 다른 쪽 쿠키를 덮어쓴다.
  assert.equal(SERVICE_MENU_COOKIE_NAME, "meters_service_menu");
  assert.notEqual(SERVICE_MENU_COOKIE_NAME, "dss_service_menu");
  assert.notEqual(SERVICE_MENU_COOKIE_NAME, "meters_session");
  assert.notEqual(SERVICE_MENU_COOKIE_NAME, "meters_sso_tx");
});

test("🔴 dss_services 클레임이 없으면 토큰이 null 이다 — 쿠키를 굽지 않는다(포털 배포 전 상태)", () => {
  assert.equal(createServiceMenuToken(undefined), null);
  assert.equal(createServiceMenuToken(null), null);
  // 배열이 아니거나, 배열이어도 그릴 수 있는 칸이 하나도 없으면 같은 취급이다.
  assert.equal(createServiceMenuToken("dss-meters"), null);
  assert.equal(createServiceMenuToken([]), null);
  assert.equal(createServiceMenuToken([{ id: "x", name: "주소 없음" }]), null);
  assert.equal(
    createServiceMenuToken([{ id: "x", name: "나쁜 주소", url: "javascript:alert(1)" }]),
    null,
  );
});

test("클레임이 있으면 구운 토큰이 같은 목록으로 되돌아온다(차례도 그대로)", () => {
  const token = createServiceMenuToken(SERVICES);
  assert.ok(token);
  assert.deepEqual(parseServiceMenuToken(token), SERVICES);
});

test("그릴 수 없는 칸만 걸러 낸다 — 나머지 칸은 남는다", () => {
  const token = createServiceMenuToken([
    { id: "dss-meters", name: "계측기 관리", url: "/meters" },
    { id: "", name: "빈 id", url: "http://10.0.0.5:3000" },
    { id: "bad", name: "나쁜 주소", url: "javascript:alert(1)" },
    { id: "dss-meters", name: "겹친 id", url: "http://10.0.0.5:3400" },
  ]);
  assert.ok(token);
  assert.deepEqual(parseServiceMenuToken(token), [
    { id: "dss-meters", name: "계측기 관리", url: "/meters" },
  ]);
});

test("🔴 서명이 붙어 있다 — 페이로드를 고치면 서명이 어긋나 빈 목록이 된다", () => {
  const token = createServiceMenuToken(SERVICES);
  assert.ok(token);
  const [payload, signature] = token.split(".");
  assert.ok(payload && signature, "토큰이 payload.signature 모양이 아니다");

  // 브라우저에서 값을 바꿔 가짜 링크를 심으려는 시도.
  const forgedPayload = Buffer.from(
    JSON.stringify({
      services: [{ id: "evil", name: "가짜", url: "http://10.0.0.9:9999" }],
      issuedAt: nowSeconds(),
      expiresAt: nowSeconds() + serviceMenuMaxAgeSeconds(),
    }),
    "utf8",
  ).toString("base64url");

  assert.deepEqual(parseServiceMenuToken(`${forgedPayload}.${signature}`), []);
  assert.deepEqual(parseServiceMenuToken(`${payload}.${signature}xx`), []);
  assert.deepEqual(parseServiceMenuToken(forgedPayload), []);
  assert.deepEqual(parseServiceMenuToken(""), []);
  assert.deepEqual(parseServiceMenuToken("."), []);
});

test("🔴 용도가 다른 서명은 거절된다 — 로그인 왕복 쿠키를 여기에 옮겨 넣을 수 없다", () => {
  const body = {
    services: SERVICES,
    issuedAt: nowSeconds(),
    expiresAt: nowSeconds() + serviceMenuMaxAgeSeconds(),
  };
  // 같은 비밀값 · 같은 HMAC 인데 용도 표시만 다르다.
  assert.deepEqual(parseServiceMenuToken(sealSigned("sso-tx", body)), []);
  assert.deepEqual(parseServiceMenuToken(sealSigned("", body)), []);
  // 실제 왕복 쿠키 값(sealTransaction)도 마찬가지다.
  const tx = sealTransaction({
    state: "s",
    nonce: "n",
    codeVerifier: "v",
    returnTo: "/",
    expiresAt: nowSeconds() + 600,
  });
  assert.deepEqual(parseServiceMenuToken(tx), []);
  // 반대 방향도 막혀 있다(그쪽은 oidc.ts 가 본다).
  assert.ok(sealSigned(PURPOSE, body) !== tx);
});

test("🔴 다른 비밀값으로 서명한 토큰은 거절된다", () => {
  const secret = process.env.SSO_TX_SECRET;
  process.env.SSO_TX_SECRET = "another-secret-that-is-long-enough-0123456789";
  const foreign = sealSigned(PURPOSE, {
    services: SERVICES,
    issuedAt: nowSeconds(),
    expiresAt: nowSeconds() + serviceMenuMaxAgeSeconds(),
  });
  process.env.SSO_TX_SECRET = secret;

  assert.deepEqual(parseServiceMenuToken(foreign), []);
});

test("수명이 세션과 같고, 지난 토큰은 빈 목록이 된다", () => {
  const before = nowSeconds();
  const token = createServiceMenuToken(SERVICES);
  assert.ok(token);

  const decoded = payloadOf(token);
  // env.sessionHours 의 기본값은 12시간이다(lib/env.ts).
  assert.equal(serviceMenuMaxAgeSeconds(), 12 * 60 * 60);
  assert.equal(decoded.expiresAt - decoded.issuedAt, serviceMenuMaxAgeSeconds());
  assert.ok(Math.abs(decoded.issuedAt - before) <= 5);

  const expired = sealSigned(PURPOSE, {
    services: SERVICES,
    issuedAt: before - 10,
    expiresAt: before - 1,
  });
  assert.deepEqual(parseServiceMenuToken(expired), []);
});

test("서명은 맞지만 안이 이상한 토큰도 죽지 않고 빈 목록이 된다 — 띠 때문에 본문이 죽어서는 안 된다", () => {
  const after = nowSeconds() + serviceMenuMaxAgeSeconds();

  assert.deepEqual(parseServiceMenuToken(sealSigned(PURPOSE, "문자열")), []);
  assert.deepEqual(parseServiceMenuToken(sealSigned(PURPOSE, null)), []);
  // 만료 시각이 없으면 언제까지 믿어도 되는지 알 수 없다.
  assert.deepEqual(parseServiceMenuToken(sealSigned(PURPOSE, { services: SERVICES })), []);
  assert.deepEqual(
    parseServiceMenuToken(sealSigned(PURPOSE, { services: "배열이 아님", expiresAt: after })),
    [],
  );
  assert.deepEqual(
    parseServiceMenuToken(sealSigned(PURPOSE, { services: [1, 2, 3], expiresAt: after })),
    [],
  );
});
