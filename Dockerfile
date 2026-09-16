# DSS 계측기 관리 시스템 — 운영 이미지
#
# 개발 PC에서 굽고 NAS로 옮긴다. 절차는 ../dss-deploy/runbook/02-이미지-빌드.md
#
#   docker build -t dss-meters:1.0 .
#   docker save dss-meters:1.0 -o dss-meters-1.0.tar
#   (NAS에서) docker load -i dss-meters-1.0.tar
#
# 이 저장소는 REQUIREMENTS.md 부터 NAS 이식을 전제로 썼다 — 사진 경로를
# 상대경로로만 저장하고, 파일명을 UUID 로 두고, 저장 위치를 환경변수로 뺀 것이
# 전부 그 대비다. 그래서 여기서 특별히 손볼 것이 없다.

ARG NODE_IMAGE=node:22-bookworm-slim

# ── 1단계 : 라이브러리만 설치한다 ─────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2단계 : 앱을 굽는다 ───────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드에만 쓰는 가짜 값들.
#
# `next build` 는 각 화면의 데이터를 모으려고 서버 모듈을 실제로 불러온다.
# src/lib/env.ts 의 required() 가 값이 없으면 던지는데, 이미지에는
# .dockerignore 가 .env* 를 막아 두어(그게 맞다) 값이 없다.
#
# 접속도 파일 접근도 하지 않는다. 값이 "있기만" 하면 되므로 누가 봐도 가짜인
# 값을 쓴다. 이 값들은 이 단계에만 있고 최종 이미지에는 남지 않는다
# (3단계는 별도 FROM 이다). 운영에서는 컨테이너 환경변수로 진짜 값이 들어온다.
ENV DATABASE_URL="postgres://build:build@127.0.0.1:5432/build_time_only" \
    FILE_STORAGE_ROOT="/tmp/build-time-only"

RUN npm run build

# ── 곁가지 : 저장소의 스크립트를 돌리는 도구 이미지 ───────────────────
#
# 운영 이미지(3단계)에는 tsx 가 없다 — devDependency 라서다. 그래서 그 안에서는
# `npm run send-notify` 같은 것을 부를 수 없다. 교정 기한 알림이 NAS 에서 돌려면
# 그 자리를 맡을 이미지가 하나 필요하다.
#
#   docker build --target tools -t dss-meters-tools:1 .
#
# 평소에는 뜨지 않는다. NAS 에서는 compose 의 `profiles: [tools]` 서비스로 두고
# 작업 스케줄러가 부를 때만 잠깐 떴다 사라진다.
#
# ⚠️ 이 스테이지를 runner 뒤로 옮기지 않는다. **마지막 스테이지가 `docker build`
#    의 기본 대상**이라, 뒤에 두면 `--target` 없이 구운 이미지가 앱이 아니라
#    도구가 된다 — 그리고 그 이미지는 `node server.js` 를 모른다.
#
# deps 를 이어받는 이유: `--target builder` 로 builder 를 재사용하면 .next 빌드
# 산출물까지 딸려 온다. 도구는 그것을 쓰지 않는다.
#
# pg_dump 는 넣지 않았다 — 야간 백업은 DB 컨테이너에서 직접 뜬다
# (dss-deploy/nas/jobs/backup-nightly.sh). 이 이미지로 `npm run backup` 을 돌릴
# 일이 생기면 그때 3단계와 같은 방식으로 더한다.
FROM ${NODE_IMAGE} AS tools
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Seoul

# ⚠️ 소유자는 COPY 할 때 정한다. 다 옮겨 놓고 `RUN chown -R /app` 을 하면 그
#    한 줄이 /app 전체를 새 레이어에 한 벌 더 복사한다 — 실측 1.86GB → 이 방식 후
#    1.07GB. 3단계가 쓰는 방식과 같다.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src

# 실행 기록이 남는 곳. 스크립트가 process.cwd() 기준으로 쓰므로 /app/logs 다.
# 여기 남는 것은 `run --rm` 과 함께 사라진다 — 운영의 기록은 이 컨테이너를 부르는
# NAS 쪽 jobs/notify-daily.sh 가 root 로 setup/logs/ 에 남긴다(야간 백업과 같은 방식).
# 스크립트가 화면에 찍는 줄과 로그에 남기는 줄이 같아서 볼륨을 하나 더 붙이지 않는다.
RUN mkdir -p /app/logs && chown node:node /app/logs

USER node

# ⚠️ .env.local 은 이미지에 없다(.dockerignore 가 .env* 를 막는다). 값은 컨테이너
#    환경변수로 들어온다. 스크립트가 그 없음을 견디는 자리는 scripts/load-env.ts.
#
# 기본값은 아무것도 내보내지 않는 쪽으로 둔다. 실제 발송은 명령을 적어 부른다:
#   docker compose ... run --rm tools-meters npm run send-notify
CMD ["npm", "run", "send-notify", "--", "--dry"]

# ── 3단계 : 실행에 필요한 것만 담는다 ─────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

# pg_dump — scripts/backup.ts 가 부른다. PG_BIN 이 비어 있으면 PATH 에서 찾는데,
# 그 주석("NAS 컨테이너에서는 그쪽이 맞다")이 가리키는 것이 바로 이 자리다.
#
# ⚠️ Debian bookworm 의 기본 저장소에는 15 까지만 있다. 서버가 17 이므로
#    공식 저장소를 추가해 17 을 받는다. 클라이언트가 낮으면 거절당한다.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    install -d /usr/share/postgresql-common/pgdg; \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc; \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends postgresql-client-17; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /var/lib/apt/lists/*

# standalone 은 public 과 .next/static 을 자동으로 담지 않는다(Next 문서 output.md).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

RUN mkdir -p .next/cache && chown -R node:node /app

USER node

# ⚠️ 계측기 사진과 교정 성적서는 이미지에 없다. FILE_STORAGE_ROOT 가 가리키는
#    폴더에 있고, 운영에서는 볼륨으로 붙인다(개발 PC 는 C:/WEB-DATA/dss-meters,
#    NAS 는 /data). 이미지를 새로 올려도 파일은 그대로 남는다.
#
#    볼륨을 붙일 때 쓰기 권한을 node 사용자(uid 1000)에게 줘야 한다.
#    안 그러면 사진 업로드가 조용히 실패한다.
ENV PORT=3300 HOSTNAME=0.0.0.0
EXPOSE 3300

CMD ["node", "server.js"]
