# Hair CRM Future TODO Roadmap

## 문서 목적
- 이 문서는 Hair CRM의 차후 개발 우선순위를 고정하고, 구현 착수 전 의사결정을 빠르게 하기 위한 로드맵입니다.
- 본 문서는 기능 구현이 아니라 계획 문서이며, 상대적 실행 순서(Phase) 기준으로 관리합니다.
- 범위는 워크스페이스 코드베이스와 `pencil-hairshopcrm.pen` 분석 결과를 기반으로 한 13개 기능입니다.

## 우선순위 기준
- `P0`: 보안/데이터 보호, 예약 운영 연속성, 운영 중단 리스크를 직접 줄이는 항목
- `P1`: 운영 효율과 품질(사용성/통계/데이터 일관성) 고도화 항목
- `P2`: 확장성/자동화/관리 편의성 중심의 중장기 항목

## 전체 기능 리스트 (13개)
| ID | 기능 | 우선순위 | 요약 | 선행조건 | 예상효과 | 난이도(S/M/L) |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | RLS 정책 정리 | P0 | `Allow all` 성격 정책 제거 및 인증/역할 기반 접근 정책 정비 | 현재 정책/권한 매트릭스 정리 | 데이터 노출 리스크 감소, 권한 경계 명확화 | M |
| R-02 | 예약 수정·취소·상태변경 | P0 | 예약 상세/리스트에서 수정, 취소, 완료 처리 가능하게 확장 | R-01, 상태 전이 규칙 정의 | 운영 중 변경 대응력 향상, 수기 작업 감소 | M |
| R-03 | 더블부킹/영업시간 충돌 방지 | P0 | 저장 전 충돌 검증 + 서버/DB 레벨 보호 로직 적용 | R-05(영업시간), 슬롯 규칙 정의 | 예약 오류/노쇼 비용 감소 | L |
| R-04 | 날짜·시간대 정합성 개선 | P0 | KST 기준 날짜 경계 처리, UTC 변환 규칙 통일 | 공통 날짜 유틸 설계 | 일자 오판/통계 왜곡 방지 | M |
| R-05 | 설정 페이지 실구현 | P0 | 영업시간, 휴무일, 기본 시술/소요시간, 운영 기본값 관리 UI 제공 | 설정 데이터 모델 합의 | 운영 정책의 중앙 관리, 수동 변경 감소 | M |
| R-06 | PWA 완성 (`next-pwa`, SW/캐시 전략) | P1 | 설치성/오프라인/업데이트 정책을 서비스워커 포함 형태로 완성 | 캐시 정책 결정(네트워크 우선/캐시 우선) | 모바일 앱 유사 경험 강화, 재방문성 개선 | L |
| R-07 | 고객 정보 편집·삭제 + 중복고객 처리 | P1 | 고객 상세 편집/삭제, 중복 탐지 및 병합/정리 플로우 제공 | R-01, 데이터 보존 규칙 | 고객 데이터 품질 향상, 검색 정확도 개선 | M |
| R-08 | 서비스 마스터(가격/기본 소요시간) | P1 | 기존 `salon_service_defaults` 확장과 예약 snapshot으로 서비스·가격을 표준화 | nullable 가격/FK, DB trigger, RLS 계약 확정 | 통계/정산 정확도 향상 | M |
| R-13 | 예약 고객 검색·빠른 등록 | P1 | 예약 화면에서 활성 고객 이름 검색과 인라인 고객 등록·자동 선택을 제공 | R-07 고객 validation·중복 정책 | 예약 등록 이탈·재입력 감소 | M |
| R-09 | 통계 고도화(매출/객단가/재방문율) | P1 | 기존 건수 통계를 매출/단가/리텐션 지표로 확장 | R-04, R-08 | 의사결정 지표 품질 향상 | M |
| R-10 | 권한관리 UI(직원 초대/권한변경) | P2 | 원장이 직원 계정의 역할을 UI에서 관리 가능하게 구성 | R-01, 초대 흐름 합의 | 운영 권한 관리 비용 절감 | L |
| R-11 | 알림 자동화(예약 리마인드/재방문) | P2 | 예약 전/재방문 리마인드 자동 발송 플로우 구축 | R-02, R-08, R-10, 채널 선택 | 노쇼 감소, 재방문율 상승 | L |
| R-12 | CSV 내보내기/백업 | P2 | 고객/예약 데이터 내보내기 및 운영 백업 지원 | 개인정보 마스킹/보관 정책 | 운영 안정성 및 데이터 이관 용이성 향상 | M |

## 단계별 실행 계획
### Phase 1 (P0 안정화)
- `R-01` RLS 정책 정리
- `R-02` 예약 수정·취소·상태변경
- `R-03` 더블부킹/영업시간 충돌 방지
- `R-04` 날짜·시간대 정합성 개선
- `R-05` 설정 페이지 실구현

## 구현 상태
| ID | 상태 | 근거 | 다음 액션 |
| --- | --- | --- | --- |
| R-01 | Done (live + fresh replay verified) | `Allow all`/`auth.role()` 기반 정책 제거, owner/staff RLS, explicit grants를 `20260707155922_r01_rls_policy.sql` 및 `schema.sql`에 반영했고 live/fresh owner·staff·anon 경계를 검증 | 신규 Auth profile provisioning, `rls_auto_enable`, GraphQL 노출, leaked-password protection 등 advisor 잔여 항목은 별도 보안/운영 backlog로 분리 |
| R-02 | Done (live verified) | 예약 상태 check constraint/RPC, 상태 배지, 완료/취소/확정 액션, inline 수정 패널을 구현했고 live RPC/UI/감사 필드 smoke와 모바일 390x844/360x800 screenshot 검증 완료 | 취소 reason 입력 UX는 현재 browser prompt 기반이므로 후속 UI polish 시 modal/form 전환 검토 |
| R-03 | Done (live + fresh replay verified) | DB 레벨 더블부킹/영업시간/휴게시간/휴무일 guard, 날짜 단위 advisory lock, cancelled/completed 비점유 규칙을 live DB와 PostgreSQL 17 disposable replay에서 검증 | full Supabase `db reset`은 Docker/config 부재로 미실행이며 대량 동시성 부하는 후속 검증 |
| R-04 | Done (live verified) | 화면별 날짜 key/달력/상대 날짜 계산을 `lib/dateTime.js` KST 유틸로 공통화하고 정적 검색, build, 모바일 `/appointments` smoke 통과 | 실제 자정/월경계 time-travel 자동 테스트는 별도 unit/e2e로 후속 보강 |
| R-05 | Done (live verified) | `.pen` 설정 UI, owner 설정 조회/저장, 예약 생성 기본값 조회를 구현했고 live owner 설정 write/staff write 차단/anon 차단 smoke 검증 완료 | staff 설정 페이지 UI 라우팅은 후속 browser 검증 대상입니다. 설정·고객·예약 문서 NetworkOnly 및 cache 0건은 R-06에서 확인했고 실기기 SW update는 별도 후속 검증으로 유지 |
| R-06 | Done (production asset smoke verified) | Next 15.5.20/React 19.0.7, npm audit 0, build·SW·390x844/360x800 정적 offline smoke·민감 문서 cache 0건·Pencil 원본 node 14개/hash 변경·console/RSC 0건에 더해 canonical Production의 manifest/SW/offline/favicon/192·512 icon HTTP 200 확인 | 실제 기기의 install prompt/standalone/서비스워커 update와 고정 URL precache 자산 갱신 정책은 후속 검증 |
| R-07 | Done (production deployed; public endpoint rechecked) | release 세션에서 실제 owner/staff/anon Data API/RPC 106개·fixture residue 0건과 `main@16157f89976e41f5218377712d5d77026bc14417` Production 배포를 확인했습니다. 이번 감사에서 live migration version 9개, RPC 7개·audit table 2개, 고객 5건·예약 6건 기준선과 canonical 공개/PWA 자산 200·Cron 무인증 401을 재확인 | 승인 Cron 200·DB probe·Runtime log와 post-deploy 실제 browser owner/staff는 이번 감사에서 재실행하지 않음. 실기기 install/standalone/SW update, `prefetch={false}` 체감 속도는 후속 작업 |
| R-08 | Done (production deployed; live transactional smoke verified) | PR #16 merge `main@01440b6`, exact 10번째 live migration `20260712093510_r08_service_master`, 기존 서비스 4건·예약 7건 no-backfill, live owner/staff/anon·snapshot transaction smoke와 synthetic residue 0건을 확인했습니다. Vercel Production deployment `6N4gbJURzr8GX4omNErBZEA8VRzQ` 성공, canonical 공개 route/PWA asset과 R-08 bundle marker도 확인했습니다. | 실제 로그인 owner/staff browser smoke와 초기 서비스 가격·기본 서비스 운영 입력은 비차단 후속 검증으로 추적 |
| R-13 | Done (production deployed; public/PWA smoke verified) | PR #18 merge `main@f904bcf`, Vercel Production deployment `dpl_5VemJYn7XhZAorkpEaHBNZN9x85o`, canonical `/appointments/new`·로그인 redirect·manifest/SW/offline/favicon/192·512 icon HTTP 200과 console 0건을 확인했습니다. 로컬에서는 Pencil 6개 상태, 390×844·360×800 mock 검색·중복·성공/실패/취소 draft 보존과 `customers?select=id,name` 최소 조회를 검증했습니다. | 실제 owner/staff 로그인·모바일 실기기 IME/standalone은 후속 운영 검증. 전용 Preview synthetic 데이터만 사용하고 Production 데이터 smoke는 별도 승인 전 금지 |
| R-09 | Done (production deployed; exact live migration/ACL/PWA verified) | PR #20 merge `main@b63f9a3`, exact 11번째 live migration `20260712124959_r09_stats_advanced`, RPC invoker/stable/search_path/ACL, Vercel deployment `dpl_FBDsYn26v2ZXiJthe5z97vsJDwk2`, canonical redirect·PWA assets·offline fallback을 확인했습니다. local Pencil/SQL/build/mobile 검증과 synthetic residue 0 근거도 유지합니다. | live authenticated 실제 데이터 smoke와 실기기 install/standalone은 후속 운영 검증. R-10/R-11은 별도 작업으로 유지 |
| R-12 | Done (production deployed; Preview role/PWA + Production public/API boundary verified) | PR #22 merge `main@7a107c4`, Vercel deployment `FxRGiDSgHQFXARsc2mUyCrsydtY8`, canonical R-12 설정 chunk·공개/PWA 자산·무인증 export `401 + no-store`를 확인했습니다. Node tests 10/10·100,005행과 전용 Preview anon 401/staff 403/owner 고객·예약 200, 모바일 UI/PWA cache, residue 0 근거를 유지합니다. Production DB는 비식별 count/RLS/grant/residue만 배포 전후 재확인했습니다. | 모바일·Safari Blob fallback 메모리, Vercel 함수 실행시간, 다중 페이지 비-snapshot 특성은 운영 규모 부하 검증 필요. Production 실제 owner CSV 생성은 개인정보 보관 책임 때문에 의도적으로 미실행 |

## Phase 1 live 검증 요약 (2026-07-08)
- Supabase 프로젝트 `burtyhairCRM`은 `ACTIVE_HEALTHY` 상태였고, Phase 1 migration 5개(`r01`, `r02`, `r05`, `r03`, `phase1_function_privilege_hardening`)를 live DB에 적용했습니다.
- RLS/RPC/R-03 live smoke는 owner/staff/anon 경계, 설정 write 권한, `set_appointment_status`, 더블부킹, 영업시간 외, 휴게시간, 휴무일, cancelled/completed 비점유, 동시성 guard를 포함해 통과했습니다.
- R-02 UI는 `/appointments` 인증 세션에서 완료/취소/확정/수정 버튼, 취소 reason 저장, 재확정 시 감사 필드 초기화, 390x844/360x800 편집 패널을 검증했습니다.
- Pencil MCP는 `.pen` 파일을 직접 읽지 않고 `snapshot_layout`과 PNG export를 실행했으며, 예약 페이지 layout problem은 없었습니다.
- 당시 Claude Opus alias 리뷰에서는 R-03/R-05 상대 migration 순서만 정리됐고 기존 MVP base table migration 부재로 전체 빈 DB replay가 미지원이라는 리스크를 확인했습니다. 이 리스크는 아래 2026-07-11 통합 준비에서 A안 baseline으로 해소했습니다.

## Phase 1 통합 준비 검증 (2026-07-11)
- 선택 결과: fresh DB A안, Auth profile 자동 생성 별도 작업 분리, hardening 의도적 rollback 불가.
- `20260219000000_phase1_genesis_baseline.sql`을 추가하고 forward migration 8개를 14자리 timestamp로 정규화했습니다. live 적용된 Phase 1 다섯 파일은 live migration version과 timestamp를 일치시켰습니다.
- `*.down.sql`은 fresh replay 대상에서 빠지도록 `supabase/rollbacks/`로 분리했습니다.
- PostgreSQL 17 disposable DB에서 전체 forward replay, 핵심 테이블/RLS/realtime, owner/staff/anon, 상태 RPC, 더블부킹, 영업시간, 휴게시간, 휴무일을 검증했습니다.
- migration replay와 `schema.sql` snapshot의 table/constraint/index/policy/function/trigger/ACL/realtime 구성을 정규화 비교해 semantic diff가 없음을 확인했습니다.
- live read-only 재확인에서 프로젝트 `ACTIVE_HEALTHY`, Auth/profile 각 2건과 누락 0건, 자동 profile 함수/trigger 부재, Phase 1 함수 `search_path=public`, 사용자 호출 RPC/helper anon 차단을 확인했습니다.
- 2026-07-12 별도 승인 아래 genesis/기존 R-03 세 version의 live 객체 동등성을 다시 확인하고 SQL 재실행 없이 history만 `applied`로 repair했습니다. R-08 착수 전에는 live/local migration 9개가 일치했고, R-08 release 후 local filename과 같은 10번째 version까지 적용됐습니다. 4~8번 live history name에는 repair 전 timestamp suffix가 남아 있어 filename stem까지 동일하다는 의미의 `exact match`로 표현하지 않습니다.

## Phase 1 통합 및 Production release 메모 (2026-07-12)
- Phase 1/R-02, Ops, R-06, R-07 stacked PR #9~#12와 Keychain 운영 보완 PR #13을 `main`에 순서대로 merge했습니다. 당시 R-07 Production 애플리케이션 release 기준은 PR #13 merge `main@16157f89976e41f5218377712d5d77026bc14417`입니다.
- Production release 기록 문서 PR #14와 Phase 2 감사 문서 PR #15가 merge됐으며 당시 최신 문서 main은 `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`이었습니다. 두 PR은 Markdown만 변경했으므로 당시 애플리케이션 release SHA와 구분합니다.
- Vercel Production deployment `5z5MKHSAyxtLrRt6ACF3UZtLBGh7`은 build 성공 후 `Staged` 상태로 custom domain 할당이 생략돼, 정확한 merge SHA를 Dashboard에서 Promote했습니다. canonical `https://hair-cr-mvibes.vercel.app`이 새 deployment의 `Current` domain임을 확인했습니다.
- migration baseline A안의 disposable fresh replay, Phase 1 history repair, R-07 production migration, 실제 role smoke, Production build/deploy와 canonical PWA/Cron/DB smoke까지 release 세션에서 완료했습니다. 이번 문서 감사에서는 canonical 공개/PWA 자산 200과 Cron 무인증 401만 현재 상태로 재확인했으며 승인 Cron 200·DB probe·Runtime log는 과거 release 근거로 유지합니다.

## Phase 2 착수 전 운영 선행 작업 (2026-07-12)
- Supabase Free inactivity 완화를 위한 Vercel 일일 keepalive를 Production에 배포했습니다.
- `CRON_SECRET`으로 보호된 server route가 고객/예약 데이터 대신 `salon_operation_settings.id` 한 컬럼만 read-only 조회합니다.
- 실제 secret은 저장소에 기록하지 않습니다. release 세션 기록상 Vercel Production에는 `SUPABASE_SECRET_KEY`, `CRON_SECRET`이 Sensitive 변수로 존재하며 로컬 검증 사본은 macOS login Keychain의 고정 alias로만 접근합니다.
- release 세션 기록상 Vercel Cron Jobs는 Enabled이고 `/api/cron/supabase-keepalive`가 `17 3 * * *`로 등록됐으며 Keychain 승인 호출 200·Runtime Warning/Error/Fatal 0건을 확인했습니다. 이번 감사에서는 무인증 `401 + application/json + no-store`만 현재 재확인했습니다.
- 2026-07-13 전용 `burtyhairCRM-preview` 프로젝트를 만들고 Vercel Preview 범위에 공개 URL/key를 설정했습니다. Preview 검증은 synthetic 데이터만 사용하며 Production 프로젝트의 고객·예약 데이터에는 접근하지 않습니다.
- keepalive는 Supabase Free uptime을 보장하지 않으며, Vercel Hobby는 내부 테스트/개인 베타 전제로만 사용합니다.
- 운영 절차: `docs/operations/supabase-free-keepalive.md`

### Phase 2 (P1 운영 고도화)
- `R-06` PWA 완성: Production 핵심 자산 smoke Done, 실기기 install/standalone/SW update 대기
- `R-07` 고객 정보 편집·삭제 + 중복고객 처리: Production DB·배포·canonical PWA/Cron/DB smoke Done, 실제 browser owner/staff 재검증 대기
- `R-08` 서비스 마스터(가격/기본 소요시간): Production DB·배포·live transactional smoke Done
- `R-13` 예약 고객 검색·빠른 등록: Production 배포·canonical 공개/PWA smoke Done
- `R-09` 통계 고도화(매출/객단가/재방문율): PR/live/Production release Done

### Phase 2 기능 착수 기준 (2026-07-12 감사)
- R-06/R-07은 재구현하지 않습니다. 미완료 실기기/browser/Preview 검증은 기능 완료 근거와 분리한 후속 운영 작업으로 추적합니다.
- R-08은 `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`에서 시작해 PR #16 merge `main@01440b6c4e3386c26a60ba786dacc90fa6d95223`, exact 10번째 live migration, Production 배포와 live transaction smoke까지 완료했습니다. 기존 worktree와 미추적 산출물은 삭제·이동·stage하지 않았습니다.
- R-13은 `origin/main@bbcb47b`에서 별도 clean worktree로 구현한 뒤 PR #18 merge `main@f904bcf`와 Production 배포·공개/PWA smoke까지 완료했습니다. 이어 R-09도 별도 clean worktree에서 구현해 PR #20 merge와 Production release까지 완료했습니다.
- R-09는 `origin/main@a360cea`에서 별도 clean worktree로 구현했고 PR #20 merge `main@b63f9a3`, exact 11번째 live migration, Production canonical 공개/PWA smoke까지 완료했습니다.

### Phase 3 (P2 확장)
- `R-10` 권한관리 UI(직원 초대/권한변경)
- `R-11` 알림 자동화(예약 리마인드/재방문)
- `R-12` CSV 내보내기/백업: PR #22 merge·Production 배포·canonical 공개/API 경계까지 Done

## 선행관계 맵
- `R-01 -> R-02 -> R-10`
- `R-05 -> R-03`
- `R-04 -> R-09`
- `R-08 -> R-09`
- `R-07 -> R-13 -> R-09` (실행 순서; R-13은 R-09 집계 계약을 변경하지 않음)
- `R-08 -> R-11`
- `R-10 -> R-11`
- `R-02 + R-03 -> R-11`

## 리스크 및 완화
- 우선순위 해석 차이: P0/P1/P2 기준(보안/운영중단/확장성)을 문서 상단에 고정합니다.
- 항목 중복 또는 누락: ID(`R-01`~`R-13`)를 고정하고 신규 항목은 `R-14`부터 순차 부여합니다.
- 문서 노후화: 스프린트 단위로 점검하며 `마지막 업데이트` 섹션을 반드시 갱신합니다.

## 의사결정 옵션(대안 2안)
### 1) 예약 충돌 처리
- `A안`: 충돌 시 경고를 노출하되 저장 허용
- `B안`: 충돌 시 저장 차단 + 대체 시간 추천
- 기본값(권장): `B안` (운영 안정성 우선)

### 2) 알림 채널
- `A안`: PWA Push 중심
- `B안`: SMS 중심
- 기본값(권장): `A안`으로 시작하고, 미수신군 보완이 필요하면 `B안` 병행

## 업데이트 규칙
- 기능 추가 시 기존 ID는 재사용하지 않고 신규 ID를 연번으로 부여합니다.
- 우선순위 변경 시 변경 사유(운영 이슈/보안/비즈니스)를 해당 항목에 한 줄로 기록합니다.
- 완료 항목은 삭제하지 않고 별도 상태 표기(`Planned`, `In Progress`, `Done`)로 추적합니다.
- 본 문서는 절대 날짜 기반 일정표가 아니라 Phase 기반 상대 순서 문서로 유지합니다.
- 실제 구현 착수는 별도 승인 후 진행하며, 구현 계획 문서는 본 로드맵을 참조합니다.

## 마지막 업데이트
- 작성일: 2026-07-13
- 2026-07-12 감사 직접 확인: GitHub PR #9~#15 merge, PR #15 merge commit `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`; 당시 Supabase live migration 9개·R-07 RPC 7개/audit table 2개·고객 5건/예약 6건 비식별 count; canonical 공개/PWA 자산 200·Cron 무인증 401
- R-07 Production release 기록: 애플리케이션 `main@16157f8`, Vercel deployment `5z5MKHSAyxtLrRt6ACF3UZtLBGh7` Promote, 실제 role smoke 106개/residue 0건, 승인 Cron 200·DB probe·Runtime log 0건. 이번 감사에서 secret 기반 검증은 재실행하지 않음
- R-08 Production 기록: PR #16 merge `main@01440b6`, live migration `20260712093510_r08_service_master`, 고객 5건·예약 7건·서비스 4건 기준선과 기존 snapshot NULL 보존, live transactional role/snapshot smoke·residue 0건, Vercel deployment `6N4gbJURzr8GX4omNErBZEA8VRzQ`, canonical R-08 bundle/PWA/Cron 공개 경계를 확인
- R-13 release 기록: PR #18 merge `main@f904bcf`, Vercel deployment `dpl_5VemJYn7XhZAorkpEaHBNZN9x85o` READY 및 canonical alias 연결, `/appointments/new` R-13 chunk·로그인 redirect·manifest/SW/offline/favicon/192·512 icon HTTP 200·console 0건 확인. Supabase 요청과 실데이터 smoke는 수행하지 않음
- R-09 release 기록: PR #20 merge `main@b63f9a3`, exact live migration `20260712124959_r09_stats_advanced`, RPC ACL 계약, Vercel deployment `dpl_FBDsYn26v2ZXiJthe5z97vsJDwk2` READY/canonical 연결, 공개 PWA/offline/Cron 무인증 경계 확인. 실제 고객·예약 fixture와 authenticated live 데이터 smoke는 수행하지 않음
- R-12 기록: `origin/main@07eefe8` 기반 `codex/r12-csv-backup`, Pencil 설정 카드, owner-only 고객/예약 스트리밍 CSV, Node tests 10/10·100,005행, build, 전용 Preview synthetic 390×844·360×800, PWA NetworkOnly·민감 응답 cache 0건 확인
- 전용 `burtyhairCRM-preview`에 forward migration 11개를 replay하고 synthetic anon/staff/owner 실제 handler smoke에서 401/403/고객 200/예약 200과 CSV 계약을 확인. Vercel Preview deployment `EXjXJCPCCjNJ3gPZgPLsntu71Cb7`, 실제 owner/staff UI, 390×844·360×800/PWA cache를 검증하고 users/identities/profiles/customers/appointments/sessions/refresh tokens residue 0을 확인
- R-12 Production release: PR #22 merge `main@7a107c4`, Vercel deployment `FxRGiDSgHQFXARsc2mUyCrsydtY8`, canonical 공개/PWA 200·설정 chunk marker·무인증 export `401 + no-store`를 확인. Production DB는 고객 6·예약 7·profile 2, RLS 9/9, 핵심 grant 3/3, residue 0의 비식별 상태만 재확인했으며 실제 owner CSV는 생성하지 않음
