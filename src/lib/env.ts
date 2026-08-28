/**
 * 실행 환경 값을 한곳에서 읽는다.
 *
 * 규칙: 비밀값이 없으면 조용히 기본값으로 넘어가지 않고 명확히 throw 한다.
 * 인증에서 "설정이 빠졌는데 그럭저럭 동작하는" 상태가 가장 위험하기 때문이다.
 *
 * getter 로 만든 이유: 모듈을 불러오는 시점이 아니라 실제로 값을 쓰는 시점에
 * 검사하기 위해서다. (빌드 중에 불필요하게 터지지 않게)
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `환경변수 ${name} 이(가) 설정되지 않았습니다. .env.local 파일을 확인하세요.`,
    );
  }
  return value.trim();
}

function flag(name: string): boolean {
  return process.env[name] === "true";
}

export const env = {
  /** PostgreSQL 접속 주소 */
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },

  /**
   * 업로드 파일 저장 루트 (절대경로).
   * DB 에는 이 루트 기준의 상대경로만 저장한다. NAS 로 옮길 때 이 값만 바뀐다.
   */
  get fileStorageRoot(): string {
    return required("FILE_STORAGE_ROOT");
  },

  /**
   * 세션 쿠키에 secure 를 붙일지.
   * 사내망 HTTP 단계에서 true 로 켜면 쿠키가 저장되지 않아 로그인이 조용히 실패한다.
   * HTTPS 를 붙인 뒤에 true 로 바꾼다.
   */
  get sessionCookieSecure(): boolean {
    return flag("SESSION_COOKIE_SECURE");
  },

  /**
   * 알림 메일에 넣을 사이트 주소.
   * 지금은 개발 주소다. NAS 에 올리거나 도메인이 생기면 이 값만 바꾼다.
   */
  get siteUrl(): string {
    const raw = process.env.SITE_URL ?? "http://localhost:3300";
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  },

  /**
   * 교정 기한 알림 메일을 보낼 cafe24 SMTP.
   *
   * 웹메일의 「환경설정 → POP3/SMTP 사용설정」 화면에 적힌 값을 그대로 쓴다.
   * 그 화면에서 SMTP 연결을 '사용함' 으로 켜 두어야 로그인이 된다.
   * 비밀번호를 바꾸면 서버에 반영될 때까지 최대 30분쯤 걸린다.
   */
  get smtp(): {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  } {
    const user = required("SMTP_USER");
    const port = Number(process.env.SMTP_PORT ?? 587);
    return {
      host: required("SMTP_HOST"),
      port: Number.isFinite(port) && port > 0 ? port : 587,
      user,
      password: required("SMTP_PASSWORD"),
      from: process.env.SMTP_FROM?.trim() || user,
    };
  },

  /** 세션 수명(시간). dss-auth SSO 세션의 절대 만료 12시간을 넘기지 않는다. */
  get sessionHours(): number {
    const raw = process.env.SESSION_HOURS;
    const n = raw ? Number(raw) : 12;
    if (!Number.isFinite(n) || n <= 0 || n > 12) return 12;
    return n;
  },

  /* ---------------------------------------------------------------- */
  /* DSS 통합 로그인 (dss-auth 포털)                                    */
  /*                                                                   */
  /* 이름을 SSO_ 로 맞춘 이유: A/S 관리 시스템도 같은 이름을 쓴다.       */
  /* Wi-Fi 가 바뀌어 IP 가 달라지면 두 시스템을 같은 방식으로 고친다.    */
  /* ---------------------------------------------------------------- */

  /**
   * 포털 주소. ID 토큰의 iss 클레임과 문자 단위로 같아야 한다.
   *
   * 끝의 슬래시를 떼는 이유: "http://x/" 와 "http://x" 가 섞이면 iss 대조가
   * 실패하는데, 원인을 찾기가 가장 어려운 종류의 버그다.
   */
  get ssoIssuer(): string {
    return required("SSO_ISSUER").replace(/\/+$/, "");
  },

  /** 포털에 등록된 이 시스템의 식별자. ID 토큰의 aud 이기도 하다. */
  get ssoClientId(): string {
    return required("SSO_CLIENT_ID");
  },

  /** 토큰 교환에만 쓴다. 브라우저에 절대 내보내지 않는다. */
  get ssoClientSecret(): string {
    return required("SSO_CLIENT_SECRET");
  },

  /**
   * 포털에 등록한 값과 문자 단위로 같아야 한다.
   *
   * 요청(request.url)에서 만들어 쓰지 않고 환경변수로 두는 이유: LAN 으로
   * 들어온 요청인데도 서버 자신의 바인딩 주소(localhost)가 보이는 경우가
   * A/S 시스템에서 실측되었다. redirect_uri 는 /authorize 와 /token 양쪽에서
   * 문자 단위로 대조되므로, 만들어 쓰면 "어떤 망에서는 되고 어떤 망에서는
   * 안 되는" 형태로 실패한다.
   */
  get ssoRedirectUri(): string {
    return required("SSO_REDIRECT_URI");
  },

  /**
   * 로그인 왕복 동안 state·nonce·PKCE 검증값을 나르는 쿠키의 서명 키.
   *
   * 이 서명이 곧 PKCE 다 — 서명이 없으면 브라우저가 code_verifier 를 제 손으로
   * 바꿔 끼울 수 있어 PKCE 가 무의미해진다.
   */
  get ssoTxSecret(): string {
    const secret = required("SSO_TX_SECRET");
    if (secret.length < 32) {
      throw new Error("SSO_TX_SECRET 은 32자 이상이어야 합니다.");
    }
    return secret;
  },
};
