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
| `SUPABASE_SECRET_KEY` | 서버 전용 | Supabase에서 발급한 최신 secret key의 Production 배포 사본. `NEXT_PUBLIC_` 접두사 금지 |
| `CRON_SECRET` | 서버 전용 | Vercel Cron 요청의 Bearer 검증용 무작위 secret |

`SUPABASE_SECRET_KEY`와 `CRON_SECRET`은 저장소, 브라우저 bundle, 로그, 응답, 문서에 실제 값을 기록하지 않습니다.
Supabase secret key의 발급·회전·폐기 원본은 Supabase이며 Vercel Production에는 배포 사본만 둡니다. 높은 권한을 가지므로 이 route 밖으로 전달하지 않고 최소 read-only 조회에만 사용합니다.

`CRON_SECRET` 생성 예시:

```bash
openssl rand -hex 32
```

출력값은 Vercel Dashboard에 직접 등록하고 채팅이나 커밋에 붙여 넣지 않습니다.
승인된 로컬 검증에서 재사용해야 하는 `CRON_SECRET`은 macOS login Keychain에만 보관하고,
[`scripts/haircrm-keychain`](./local-keychain-secrets.md)의 고정 alias와 비출력 명령으로 접근합니다.
로컬 Keychain 사본은 Vercel Production 환경변수를 대체하는 원본이 아닙니다.

## Production 적용 상태 (2026-07-12)

- release 기준은 `main@16157f89976e41f5218377712d5d77026bc14417`, Vercel deployment는 `5z5MKHSAyxtLrRt6ACF3UZtLBGh7`입니다.
- 자동 Production build는 성공했지만 deployment가 `Staged` 상태이고 custom domain 할당이 생략돼, Dashboard에서 정확한 merge SHA를 Promote했습니다. 현재 canonical은 `https://hair-cr-mvibes.vercel.app`입니다.
- Vercel Production에 `SUPABASE_SECRET_KEY`, `CRON_SECRET`이 Sensitive 변수로 존재함을 이름과 scope만 확인했습니다. 실제 값은 열거나 출력하지 않았습니다.
- Cron Jobs는 Enabled이며 `/api/cron/supabase-keepalive`가 `17 3 * * *`로 등록됐습니다.
- 무인증 요청은 `401 + application/json + no-store`, Keychain wrapper 승인 요청은 `200 + {"ok":true}`를 반환했습니다. Runtime Logs의 Warning/Error/Fatal은 각각 0건이었습니다.
- Production DB `select 1`과 임시 CA/Cron response residue 0건도 함께 확인했습니다.

## 배포 후 검증

Cron은 production deployment에서만 등록·실행됩니다. push/deploy 승인 후 다음 순서로 확인합니다.

1. Vercel Project Settings의 Production 환경에 세 변수를 등록합니다.
2. production deployment를 생성합니다.
3. Settings > Cron Jobs에서 `/api/cron/supabase-keepalive`가 하루 한 번 일정으로 등록됐는지 확인합니다.
4. secret 없는 호출이 `401`인지 확인합니다.
5. 로컬 Keychain wrapper를 사용한 수동 호출이 HTTP `200`, `application/json`, 정확한 `{"ok":true}` 응답을 반환하는지 비출력 상태로 확인합니다.

```bash
scripts/haircrm-keychain cron-request \
  'https://hair-cr-mvibes.vercel.app/api/cron/supabase-keepalive'
```

6. Vercel Runtime Logs에서 성공 여부만 확인합니다. secret이나 Supabase 응답 데이터가 로그에 없어야 합니다.
7. Supabase에서 inactivity 경고 메일이 오면 실제 앱 요청과 Dashboard 활동을 추가 확인합니다.

Production build가 성공해도 deployment가 `Staged`이고 `Assigning Custom Domains`가 `Skipped`라면 canonical은 이전 배포를 계속 가리킬 수 있습니다. 이 경우 deployment detail에서 source SHA를 다시 확인한 후 `Promote`하고, canonical의 무인증 `401`과 승인 `200`을 모두 재검증합니다.

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
