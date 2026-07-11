# Supabase Free Keepalive On Vercel

## 목적과 한계

- Vercel production Cron이 하루 한 번 Supabase에 실제 read-only DB 요청을 보내 Free 프로젝트의 비활성 일시정지 가능성을 낮춥니다.
- 이 구성은 best-effort이며 Supabase uptime을 보장하지 않습니다. 유료 플랜만 inactivity 자동 일시정지 대상에서 제외됩니다.
- Vercel Hobby는 비상업적 개인 프로젝트용입니다. 실제 미용실 영업에 사용하기 전에는 Vercel 플랜 적합성을 별도로 결정해야 합니다.
- 고객, 예약, 연락처 데이터는 조회하지 않습니다. `salon_operation_settings.id` 한 컬럼만 읽고 응답에도 포함하지 않습니다.

## 구성

- Route: `GET /api/cron/supabase-keepalive`
- Schedule: `17 3 * * *` (매일 03:17 UTC, 12:17 KST 전후)
- Vercel Hobby에서는 지정한 시간으로부터 최대 약 59분 오차가 발생할 수 있습니다.
- Route와 응답은 `no-store`이며 PWA/service worker cache 대상이 아닙니다.

## Vercel 환경변수

Production 환경에 다음 값을 직접 등록합니다.

| 이름 | 공개 여부 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 가능 | 현재 Supabase Project URL |
| `SUPABASE_SECRET_KEY` | 서버 전용 | Supabase의 최신 secret key. `NEXT_PUBLIC_` 접두사 금지 |
| `CRON_SECRET` | 서버 전용 | Vercel Cron 요청의 Bearer 검증용 무작위 secret |

`SUPABASE_SECRET_KEY`와 `CRON_SECRET`은 저장소, 브라우저 bundle, 로그, 응답, 문서에 실제 값을 기록하지 않습니다.
Supabase secret key는 높은 권한을 가지므로 이 route 밖으로 전달하지 않고 최소 read-only 조회에만 사용합니다.

`CRON_SECRET` 생성 예시:

```bash
openssl rand -hex 32
```

출력값은 Vercel Dashboard에만 등록하고 채팅이나 커밋에 붙여 넣지 않습니다.

## 배포 후 검증

Cron은 production deployment에서만 등록·실행됩니다. push/deploy 승인 후 다음 순서로 확인합니다.

1. Vercel Project Settings의 Production 환경에 세 변수를 등록합니다.
2. production deployment를 생성합니다.
3. Settings > Cron Jobs에서 `/api/cron/supabase-keepalive`가 하루 한 번 일정으로 등록됐는지 확인합니다.
4. secret 없는 호출이 `401`인지 확인합니다.
5. 로컬 shell 환경변수를 사용한 수동 호출이 `200`과 `{ "ok": true }`를 반환하는지 확인합니다.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_PRODUCTION_DOMAIN/api/cron/supabase-keepalive
```

6. Vercel Runtime Logs에서 성공 여부만 확인합니다. secret이나 Supabase 응답 데이터가 로그에 없어야 합니다.
7. Supabase에서 inactivity 경고 메일이 오면 실제 앱 요청과 Dashboard 활동을 추가 확인합니다.

## 실패 상태

| HTTP | 의미 | 대응 |
| --- | --- | --- |
| `401` | Bearer secret 불일치 | Vercel의 `CRON_SECRET`과 요청 헤더 확인 |
| `503 cron_not_configured` | `CRON_SECRET` 누락 | Production 환경변수 등록 후 재배포 |
| `503 supabase_not_configured` | URL 또는 secret key 누락 | 환경변수 scope와 이름 확인 후 재배포 |
| `502 supabase_query_failed` | Supabase 조회 실패 | 프로젝트 상태, 키 활성 여부, 테이블 존재 및 Vercel 로그의 error code 확인 |

## 복구와 운영

- Cron을 중단하려면 Vercel Dashboard에서 Cron Jobs를 비활성화하거나 `vercel.json` 항목을 제거하고 재배포합니다.
- secret 노출이 의심되면 `CRON_SECRET`과 `SUPABASE_SECRET_KEY`를 즉시 회전합니다.
- Supabase Free 프로젝트가 일시정지되면 Dashboard에서 90일 안에 resume합니다.
- Free 프로젝트는 정기 백업을 별도로 보관해야 합니다. keepalive는 백업을 대체하지 않습니다.

## 공식 참고

- [Supabase Free Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase API Keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Cron Usage And Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
