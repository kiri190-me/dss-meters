/**
 * 이 사이트의 기존 이용자를 포털(dss-auth) 계정에 잇는다.
 *
 * 왜 필요한가: 통합 로그인을 붙이기 전에 임시 로그인으로 만들어 둔 행들은
 * `auth_sub` 에 가짜 값이 들어 있다. 그대로 두면 같은 사람이 포털로
 * 들어왔을 때 처음 보는 사람이 되어 **열람자 행이 새로 하나 더** 생기고,
 * 예전 행의 관리자 권한과 감사 기록은 주인 없이 남는다.
 *
 * 이 연결을 자동으로 하지 않는 이유: 이름이나 이메일이 같다고 같은 사람으로
 * 이어 버리면, 포털 쪽에 이름을 맞춰 넣는 것만으로 남의 관리자 계정을 차지할
 * 수 있다. 사람이 한 번 명시적으로 잇는다.
 *
 * 사용법:
 *   npm run sso:link
 *     → 이 사이트의 이용자 목록 (누가 아직 안 이어졌는지 보인다)
 *
 *   npm run sso:link -- --user "이남준" --sub 0f8f2c1e-....
 *     → 그 사람을 포털 사용자 ID(uuid)에 잇는다
 *
 * --user 는 표시 이름이나 이 사이트의 사용자 id(uuid) 중 무엇으로도 준다.
 * --sub 는 **포털의 users.id** 다. 포털 관리 화면(/admin/users)에서 확인한다.
 *
 * PowerShell 이 아니라 TypeScript 로 작성한다 (NAS 리눅스 컨테이너에서도 돌아야 함).
 */
import { eq, ne, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { webUsers } from "../src/lib/db/schema";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("환경변수 DATABASE_URL 이 없습니다. .env.local 을 확인하세요.");
    process.exit(1);
  }
  return url;
}

const client = postgres(connectionString(), { max: 1 });
const db = drizzle(client, { schema: { webUsers } });

async function list(): Promise<void> {
  const rows = await db
    .select()
    .from(webUsers)
    .where(eq(webUsers.isDeleted, false));

  if (rows.length === 0) {
    console.log("등록된 이용자가 없습니다.");
    console.log(
      "\n아무도 없어도 괜찮습니다 — 포털로 처음 들어온 사람은 열람자로 자동 등록됩니다.",
    );
    return;
  }

  console.log("이 사이트의 이용자:\n");
  for (const row of rows) {
    const last = row.lastLoginAt
      ? row.lastLoginAt.toISOString().slice(0, 16).replace("T", " ")
      : "없음";
    console.log(`  ${row.displayName}  [${row.role}]`);
    console.log(`      id       ${row.id}`);
    console.log(`      auth_sub ${row.authSub}`);
    console.log(`      마지막 로그인 ${last}`);
  }
  console.log(
    "\n포털 계정에 이으려면:\n" +
      '  npm run sso:link -- --user "이름" --sub <포털 사용자 ID>',
  );
}

async function link(userKey: string, sub: string): Promise<void> {
  if (!UUID_PATTERN.test(sub)) {
    console.error(`--sub 가 uuid 형식이 아닙니다: ${sub}`);
    console.error("포털 관리 화면(/admin/users)에 보이는 사용자 ID 를 그대로 넣으세요.");
    process.exitCode = 1;
    return;
  }

  const alive = eq(webUsers.isDeleted, false);
  const found = UUID_PATTERN.test(userKey)
    ? await db
        .select()
        .from(webUsers)
        .where(and(eq(webUsers.id, userKey), alive))
        .limit(2)
    : await db
        .select()
        .from(webUsers)
        .where(and(eq(webUsers.displayName, userKey), alive))
        .limit(2);

  if (found.length === 0) {
    console.error(`"${userKey}" 에 해당하는 이용자가 없습니다.`);
    process.exitCode = 1;
    return;
  }
  if (found.length > 1) {
    // 이름이 겹치면 어느 쪽인지 사람이 골라야 한다. 잘못 이으면 남의 계정을
    // 넘겨주는 일이라 조용히 첫 번째를 고르지 않는다.
    console.error(`"${userKey}" 라는 이름이 둘 이상입니다. --user 에 id(uuid)를 주세요.`);
    process.exitCode = 1;
    return;
  }
  const user = found[0];

  // auth_sub 에는 조건 없는 유일 색인이 있다. 먼저 확인해서 색인 충돌 대신
  // 사람이 읽을 수 있는 말로 알려 준다.
  const [taken] = await db
    .select({ id: webUsers.id, displayName: webUsers.displayName })
    .from(webUsers)
    .where(and(eq(webUsers.authSub, sub), ne(webUsers.id, user.id)))
    .limit(1);

  if (taken) {
    console.error(
      `이 포털 계정은 이미 "${taken.displayName}" 에 이어져 있습니다 (id ${taken.id}).`,
    );
    console.error("한 포털 계정은 한 사람에게만 이을 수 있습니다.");
    process.exitCode = 1;
    return;
  }

  if (user.authSub === sub) {
    console.log(`"${user.displayName}" 은(는) 이미 이 포털 계정에 이어져 있습니다.`);
    return;
  }

  const before = user.authSub;
  await db
    .update(webUsers)
    .set({ authSub: sub, updatedAt: new Date() })
    .where(eq(webUsers.id, user.id));

  console.log(`"${user.displayName}" 을(를) 포털 계정에 이었습니다.`);
  console.log(`  이전 auth_sub  ${before}`);
  console.log(`  새 auth_sub    ${sub}`);
  console.log(`  이 사이트의 역할 ${user.role} (그대로 둡니다)`);
  console.log(
    "\n다음 로그인부터 이 행으로 들어옵니다. 예전 세션은 그대로이니,\n" +
      "필요하면 포털에서 로그아웃해 세션을 끊으세요.",
  );
}

async function main(): Promise<void> {
  const user = arg("user");
  const sub = arg("sub");

  if (!user && !sub) {
    await list();
    return;
  }
  if (!user || !sub) {
    console.error("--user 와 --sub 를 함께 주세요.");
    console.error('  npm run sso:link -- --user "이남준" --sub <포털 사용자 ID>');
    process.exitCode = 1;
    return;
  }
  await link(user, sub);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
