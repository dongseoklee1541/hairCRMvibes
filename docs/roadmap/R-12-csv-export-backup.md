# R-12 CSV 내보내기/백업

## 상태
- Ready for review (Preview deployed/verified; Draft PR #22)
- 구현 브랜치: `codex/r12-csv-backup`
- 기준: `origin/main@07eefe8f2b0431ec9473bf23bf38170d9ac61157`
- 최종 업데이트: 2026-07-13

## 목표와 결과
- owner가 `/settings`에서 고객과 예약 전체 데이터를 각각 CSV로 내려받을 수 있습니다.
- 다운로드 전에 민감정보 보관 책임을 명시적으로 확인해야 하며, 미확인 상태에서는 두 버튼이 비활성화됩니다.
- 서버 Route Handler가 사용자 JWT를 검증하고 profile role을 `owner`로 다시 확인한 뒤 기존 RLS로 데이터를 읽습니다.
- 데이터베이스 migration, RLS, RPC, grant, schema는 변경하지 않았습니다.
- 응답은 1,000행 단위로 스트리밍하며 기존 100,000행 애플리케이션 상한을 제거했습니다.

## 개인정보·권한·보관 경계
- `/api/export`는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 요청 사용자의 Bearer JWT만 사용합니다. service-role/secret key를 읽거나 사용하지 않습니다.
- `auth.getUser(token)` 검증, 본인 `profiles.role='owner'` 확인, 기존 Supabase RLS를 모두 통과해야 내보낼 수 있습니다. UI의 owner 제한만 권한 경계로 신뢰하지 않습니다.
- 응답은 `private, no-store`, `Pragma: no-cache`, `Vary: Authorization`, `nosniff`, same-origin CORP를 사용합니다.
- 서버·브라우저 저장소에 CSV를 보관하지 않습니다. File System Access API를 지원하는 브라우저는 사용자가 선택한 파일로 응답을 직접 스트리밍하고, 미지원 브라우저는 Blob URL을 클릭 직후 해제합니다. localStorage, IndexedDB, Cache Storage에는 고객 데이터를 쓰지 않습니다.
- 운영 이관·점검용 전체 행 내보내기이므로 CSV에는 고객 연락처·메모와 예약 메모가 포함됩니다. 화면에서 이를 경고하고 접근이 제한된 위치에 보관하도록 요구합니다. Auth·스키마·시점복구를 포함하는 재해복구 백업은 아닙니다.
- staff는 `403 OWNER_REQUIRED`, 미인증·만료 세션은 `401`, 허용하지 않은 데이터셋은 `400`으로 거부합니다. 오류 응답과 서버 로그에는 Supabase 상세 오류나 고객 데이터가 포함되지 않습니다.
- 파일 취급 기준은 [`docs/operations/csv-backup-handling.md`](../operations/csv-backup-handling.md)에 고정했습니다. 기기 암호화 저장소로 즉시 이동하고 최대 30일 이내에 다운로드 폴더·휴지통·클라우드 사본까지 삭제합니다.

## CSV 계약
- 고객 파일: 고객 식별자, 이름, 전화번호/정규화 번호, 메모, 생성·수정, archive/merge/anonymize 감사 필드를 고정 순서로 내보냅니다.
- 예약 파일: 예약·고객 식별자, 날짜/시간, 서비스 snapshot, 소요시간, 가격 snapshot, 메모, 상태, 생성·수정·취소 감사 필드를 고정 순서로 내보냅니다.
- UTF-8 BOM, CRLF, 모든 셀 큰따옴표 인용을 사용합니다.
- `=`, `+`, `-`, `@`, tab/CR/LF 및 공백 뒤 수식 기호로 시작하는 값 앞에 작은따옴표를 붙여 spreadsheet formula injection을 방어합니다.
- PostgREST 조회는 1,000행 단위의 결정적 정렬·페이지네이션을 사용합니다. 첫 페이지를 응답 전에 조회해 즉시 발생한 권한·조회 오류는 JSON으로 반환하고, 이후 페이지는 한 번에 한 페이지만 메모리에 두고 순서대로 CSV 스트림에 추가합니다.
- 애플리케이션 행 수 상한은 두지 않습니다. 실제 최대 처리량은 Vercel 함수 실행 시간, Supabase 응답 시간, 네트워크와 미지원 브라우저의 Blob 메모리에 의해 제한됩니다.
- 파일명 날짜는 공통 KST helper를 사용해 `haircrm_<dataset>_YYYY-MM-DD.csv`로 생성합니다.

## 구현 구조
- `app/api/export/route.js`: 동적 Node.js Route Handler와 요청 단위 환경 설정 주입
- `lib/csvExport.mjs`: 데이터셋 allowlist, owner 인증/인가, 페이지네이션, CSV `ReadableStream`, 보안 응답 헤더
- `components/settings/DataBackupCard.js`: 명시적 보관 확인, 고객/예약 독립 상태, 인증 헤더 fetch, 직접 파일 스트리밍과 Blob fallback
- `components/settings/DataBackupCard.module.css`: 56px CTA, 44px 이상 상호작용 영역, 390px 2열·360px 1열 모바일 레이아웃
- `tests/csv-export.test.mjs`: Node 내장 test runner 기반 CSV·권한·무상한 스트리밍·중단·오류 노출 회귀 테스트
- `tests/preview-csv-export-smoke.mjs`: 비밀을 파일에 저장하지 않고 전용 Preview Supabase의 실제 owner/staff/anon 경계를 검증하는 실행 스크립트

## Pencil SSOT
- 원본: `pencil-hairshopcrm.pen`
- 기존 설정 화면 `rYt9h`에 데이터 백업 카드 `mVQYv`를 추가하고 설정 설명·콘텐츠 높이·탭 위치를 함께 조정했습니다.
- warning, unchecked acknowledgment, disabled 고객/예약 CSV 버튼과 암호화 보관·30일 삭제 문구를 설계했으며 `snapshot_layout(problemsOnly)` 결과는 문제 0건입니다.
- Pencil 앱 업데이트·재실행 후 MCP로 다시 연결해 카드 렌더와 원본 파일 변경을 확인했습니다.

## 로컬·브라우저 검증 근거
- `node --test tests/csv-export.test.mjs`: 10/10 통과. BOM/CRLF/escaping/formula 방어, 100,005행 무상한 스트리밍, 요청 중단 신호, anon/staff/owner, 고객/예약 성공, 첫·후속 페이지 상세 오류 비노출, dataset allowlist를 검증했습니다.
- `npm run build`: Next.js 15.5.20 production build 통과, `/api/export`는 dynamic route로 생성되고 PWA service worker도 생성됐습니다.
- 실제 Next production server와 전용 Preview Supabase를 연결해 anon `401 AUTH_REQUIRED`, staff `403 OWNER_REQUIRED`, owner 고객·예약 `200 text/csv`를 확인했습니다. 두 owner 응답은 filename, `private, no-store`, BOM, CRLF, formula neutralization을 모두 통과했습니다.
- synthetic owner 계정으로 390×844와 360×800에서 다음을 검증했습니다.
  - 확인 전 두 버튼 disabled, 확인 후 enabled
  - native checkbox의 keyboard Space 조작과 focus ring
  - File System Access API 경로를 메모리 sink로 격리해 고객 CSV 386 bytes 직접 스트리밍과 완료 안내
  - 미지원 브라우저 경로에서 예약 CSV 489 bytes Blob 다운로드와 완료 안내; 생성 파일 검증 직후 삭제
  - CTA 56px, 확인 영역 61px 이상, 390px 2열·360px 1열, horizontal overflow 0
  - 정상 reload 뒤 console warning/error 0건
- production-mode PWA에서 service worker active/controller를 확인했습니다. 오프라인 `/api/export` 요청은 NetworkOnly로 실패했고 정확한 `/api/export` 응답, CSV 파일, Supabase 응답의 Cache Storage 항목은 각각 0건입니다. 온라인 복구 후 `/settings`와 anon `401` 응답이 정상입니다.
- Production Supabase 고객·예약 데이터는 조회·생성·수정·삭제하지 않았습니다.

## 전용 Preview 통합 근거
- Supabase Free 조직에 `burtyhairCRM-preview` 프로젝트(`ygczvpiowtexsqupkxth`, Seoul)를 새로 만들고 Production 프로젝트와 완전히 분리했습니다.
- 저장소의 forward migration 11개를 순서대로 replay했습니다. connector가 기록한 Preview migration version timestamp는 로컬 파일명과 다르지만 migration name과 적용 순서는 일치합니다.
- public table 9개가 모두 RLS 활성화 상태이고, anon의 customers/appointments select는 차단되며 authenticated 정책이 존재함을 catalog로 확인했습니다.
- 고정 synthetic ID의 owner, staff, 고객, 예약만 만들고 실제 Route Handler를 호출했습니다. 미인증 고객 요청은 `401 AUTH_REQUIRED`, staff 요청은 `403 OWNER_REQUIRED`, owner 고객·예약 요청은 각각 `200 text/csv`를 반환했습니다.
- owner 두 응답에서 filename, `no-store`, UTF-8 BOM, CRLF, 필수 synthetic 값과 formula neutralization을 확인했습니다. 비밀값과 토큰은 저장소 파일이나 명령 출력에 기록하지 않았습니다.
- Vercel 프로젝트에는 Preview 범위의 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 추가했습니다. 기존 Production/Development 값은 변경하지 않았습니다.
- commit `0680d9f`의 Vercel Preview deployment `EXjXJCPCCjNJ3gPZgPLsntu71Cb7`이 `Ready`이고, branch domain `hair-cr-mvibes-git-codex-r12-c-ddf281-dongseoklee1541s-projects.vercel.app`이 생성됐습니다.
- 실제 Vercel Preview에서 owner는 `/settings` 데이터 백업 카드와 정책 문구를 확인했고, staff는 `권한 없음` 화면으로 차단됐습니다. 무인증 배포 API는 `401 AUTH_REQUIRED`를 반환했습니다.
- 검증 후 고정 synthetic appointment/customer/Auth 사용자를 삭제했습니다. users, identities, profiles, customers, appointments, sessions, refresh tokens가 모두 0이고 기본 설정 1건·영업시간 7건·서비스 4건은 유지됨을 확인했습니다.
- GitHub Draft PR: [#22 R-12 CSV 스트리밍 백업 추가](https://github.com/dongseoklee1541/hairCRMvibes/pull/22)

## 스크린샷
- before 390×844: `/Users/idongseog/.codex/visualizations/2026/07/13/019f59d5-495d-7680-8dec-3af3a123585c/r12/20260713_settings_r12_before_390x844.png`
- before 360×800: `/Users/idongseog/.codex/visualizations/2026/07/13/019f59d5-495d-7680-8dec-3af3a123585c/r12/20260713_settings_r12_before_360x800.png`
- final policy unchecked 390×844: `/Users/idongseog/.codex/visualizations/2026/07/13/019f59d5-495d-7680-8dec-3af3a123585c/r12-final/20260713_settings_r12_policy_after_390x844.png`
- final policy checked 390×844: `/Users/idongseog/.codex/visualizations/2026/07/13/019f59d5-495d-7680-8dec-3af3a123585c/r12-final/20260713_settings_r12_policy_checked_390x844.png`
- final policy checked 360×800: `/Users/idongseog/.codex/visualizations/2026/07/13/019f59d5-495d-7680-8dec-3af3a123585c/r12-final/20260713_settings_r12_policy_checked_360x800.png`
- 모든 화면은 synthetic 데이터만 사용하며 실제 고객 개인정보가 없습니다.

## Rollback
- 애플리케이션·설계·문서 파일을 이 변경 commit 단위로 revert합니다.
- R-12는 신규 migration/schema를 만들지 않았습니다. 애플리케이션 rollback이 필요하면 Vercel Preview 변수 두 개를 제거하고 전용 Preview 프로젝트를 별도 삭제 판단하며 Production 설정은 건드리지 않습니다.
- synthetic 검증 데이터는 정확한 고정 ID로 삭제하고 users/identities/profiles/customers/appointments 잔존 수가 모두 0인지 확인합니다.
- rollback 뒤 production build를 다시 생성해 service worker precache revision을 갱신합니다.

## 남은 리스크와 통합 검증 경계
- Production 실제 owner 다운로드는 고객 개인정보 파일 생성과 보관 책임이 발생하므로 이번 범위에서 실행하지 않았습니다.
- 서버는 페이지 단위로 스트리밍하지만 Vercel 함수 실행 시간과 Supabase/네트워크 지연은 남아 있습니다. 현 데이터 규모를 크게 넘기는 운영 전에는 실제 규모 부하 검증과 필요 시 비동기 export를 별도 설계합니다.
- File System Access API가 없는 모바일·Safari 계열은 Blob fallback을 사용하므로 매우 큰 파일에서 클라이언트 메모리 사용량이 커질 수 있습니다.
- 브라우저 다운로드 이후 파일의 암호화·접근통제·삭제주기는 운영자와 기기 정책의 책임이며 애플리케이션이 강제하지 못합니다.
- Production 실제 owner 다운로드, `main` merge와 Production 배포는 이번 Draft PR 범위에서 수행하지 않았습니다.
