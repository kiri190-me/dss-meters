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
