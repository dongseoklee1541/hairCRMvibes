# AI-slop remediation 교차 품질 개선 (2026-07-16)

## 상태

- 구현 완료 · 로컬 합성 검증 완료
- 별도 R 번호를 만들지 않는 cross-cutting 품질 개선 기록
- 대상 브랜치: `codex/ai-slop-remediation`
- 시작 기준: `main@93c94bbac22d263cdca5fcb6ab0ee6b7e7295523`

## 목적과 범위

기존 기능을 새로 확장하기보다 생성형 코드에서 흔히 남는 중복, 과도한 조회, 실패 상태 결합, 불명확한 상태 문구, 접근성 누락과 기본 템플릿 잔재를 정리했습니다.

- 홈 고객 목록과 오늘 예약 요청을 분리해 한쪽 실패가 다른 기능을 막지 않도록 했습니다.
- 고객 목록은 서버 검색, exact count, 50개 단위 pagination과 `고객 더 보기`를 사용합니다.
- 예약 목록의 월간 예약 표시와 선택 날짜 예약 요청을 서로 독립된 오류 상태로 관리합니다.
- 가격 미설정, 무료(0원), 유료를 공통 표시 유틸로 구분합니다.
- 설정 조회 실패 시 기존 기본값을 저장하지 못하도록 관련 입력과 저장 버튼을 잠급니다.
- 휴무일 충돌 확인창에 dialog semantics, Escape, Tab 순환, 닫은 뒤 초점 복귀와 44px 이상 터치 영역을 적용했습니다.
- 중복 규칙 파일과 사용하지 않는 초기 템플릿 컴포넌트·SVG를 제거했습니다.

## 고객 검색과 개인정보 경계

고객 목록 응답은 화면 표시에 필요한 다음 필드만 반환합니다.

```text
id,name,phone,archived_at,merged_into_customer_id,anonymized_at
```

- `memo`와 `phone_normalized`는 서버 검색 조건에만 사용하고 응답 select에는 포함하지 않습니다.
- 검색 문자열은 NFKC 정규화, 길이 80자 제한과 PostgREST filter 문법 문자 제거를 거칩니다.
- 글자나 숫자가 남지 않는 특수문자-only 검색은 빈 filter로 전체 고객 조회를 실행하지 않고 결과 0건과 입력 안내를 표시합니다.
- 목록 요청은 `{ count: 'exact' }`, 이름 오름차순과 `range(offset, offset + 49)`를 사용합니다.
- 화면은 exact count와 현재 누적 결과 수를 비교해 50건씩 추가 조회합니다.
- 활성 고객과 보관 고객은 각각 `archived_at is null`과 `archived_at is not null`로 분리합니다.

## 실패·표시·접근성 경계

- 홈 고객 요청과 오늘 예약 요청은 별도 request id와 loading/error/ready 상태를 사용합니다.
- 고객 검색 실패 중에도 오늘 예약을 표시하고, 오늘 예약 실패 중에도 고객 검색을 계속 사용할 수 있습니다.
- 월간 달력 표시 실패는 날짜별 예약 목록을 지우거나 막지 않습니다.
- `formatPriceKrw`는 `null`, 빈 문자열과 비정상 숫자를 `가격 미설정`, `0`을 `무료 (0원)`, 양의 값을 원화 형식으로 표시합니다.
- 설정의 운영 기본값, 영업시간과 시술 입력은 전체 설정 조회가 성공한 `ready` 상태에서만 저장할 수 있습니다.
- 휴무일 충돌 확인창은 저장 중 닫기를 막고, 완료·취소된 예약을 선택 불가 상태로 설명하며, 확정 예약 중 취소 대상을 선택하도록 안내합니다.

## Pencil과 합성 모바일 QA

`pencil-hairshopcrm.pen`에는 다음 품질 개선 상태를 추가했습니다.

- 홈 서버 검색과 고객/오늘 예약 부분 실패
- 설정 조회 실패와 가격 미설정·무료·유료 상태
- 예약 월간 표시 실패
- 휴무일 충돌 확인 dialog

합성 데이터 기반 QA 증거는 `output/playwright/ai-slop-remediation/`에 있습니다.

- 390×844: 홈 부분 실패, 예약 월 표시 실패, 설정 조회 실패, 휴무일 dialog
- 360×800: 홈 검색 부분 실패, 예약 월 표시 실패, 설정 조회 실패·가격 상태, 휴무일 dialog
- `pencil-after/*.png`: 코드 상태와 대응하는 Pencil export
- `.playwright-cli/**`: 세션 임시 로그·DOM snapshot·자동 캡처이므로 durable evidence와 commit 범위에서 제외

화면에 사용한 고객, 예약, 전화번호와 시술은 모두 합성 값입니다. 실제 고객·예약·인증 데이터는 사용하지 않았습니다.

## 검증 결과

최종 commit 전 다음 명령을 현재 코드에서 다시 실행했습니다.

```bash
npm test
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon-key npm run build
git diff --check
```

- `npm test`: 통과
  - Node 단위 테스트 33개 통과
  - Jest 예약 race 테스트 9개 통과
- synthetic Supabase 환경 `npm run build`: 통과
  - Next.js 15.5.20 production build와 정적 페이지 15개 생성 성공
  - `/sw.js` 생성과 `/offline.html` fallback 확인
- `git diff --check`: 통과
- 390×844·360×800 합성 모바일/Pencil 증거: 코드의 홈 부분 실패, 예약 월 표시 실패, 설정 fail-closed·가격 상태와 휴무일 dialog에 대응함을 재확인

빌드가 생성하는 `public/sw.js`와 `public/workbox-*.js`는 직접 수정하거나 commit하지 않았고 build 뒤에도 별도 diff가 생기지 않았습니다. 이번 변경은 manifest, 서비스워커 또는 cache 전략을 변경하지 않습니다.

## Preview RLS 근거와 Auth/JWT defer

후속 정리 시작 시 전달받은 선행 검증 기록은 허용된 Preview 프로젝트 `burtyhairCRM-preview`(`ygczvpiowtexsqupkxth`)에서 transaction 기반 owner/staff/profileless/anon RLS 경계를 확인했다고 기록합니다.

- transaction 검증 뒤 `auth.users`, `auth.identities`, `auth.sessions`, `public.profiles`, `public.customers`, `public.appointments` residue는 모두 0건이었습니다.
- 실제 owner/staff Auth/JWT 기반 PostgREST·브라우저 검증은 완료하지 못했습니다.
- 현재 도구에서 Preview Auth Admin `createUser`를 안전하게 호출할 경로가 없었습니다.
- 고유 합성 `example.com` 주소를 사용한 owner/staff signup은 각각 HTTP 400 `email_address_invalid`였고 UUID, JWT와 session은 생성되지 않았습니다.
- 추가 계정 생성이나 다른 주소·도메인 재시도는 중단했습니다.

따라서 실제 owner/staff Auth/JWT 브라우저 검증은 **미검증 · 비차단 후속 운영 검증으로 defer**합니다. 이 기록은 실제 Auth/JWT 검증을 완료했다는 뜻이 아닙니다.

## Production·DB·비밀값 경계

- Production 프로젝트 `skcujebqxjvmzmaiddvb`의 DB/Auth/고객·예약 행은 조회하거나 변경하지 않았습니다.
- migration, schema, RLS, grant, policy와 Supabase 설정은 변경하지 않았습니다.
- 수동 Vercel deploy, Promote 또는 재배포는 수행하지 않습니다.
- 실제 key, 이메일, 비밀번호, JWT와 고객정보를 문서·commit·PR·QA 증거에 기록하지 않습니다.
- 선행 검증 PTY에 한 차례 노출된 Preview publishable key는 이 변경에서 다시 출력하지 않으며 rotation도 이번 범위가 아닙니다.
- service-role/secret key와 JWT는 노출되지 않았고 대응 Auth 계정도 생성되지 않았다는 선행 기록을 유지합니다.

## 남은 위험과 후속 항목

- 실제 owner/staff Auth/JWT PostgREST·브라우저 경계는 안전한 운영 검증 경로를 별도 승인한 뒤 확인해야 합니다.
- 모바일 실기기 IME, PWA standalone, 서비스워커 update와 장시간 사용 검증은 수행하지 않았습니다.
- 50건을 넘는 실제 운영 규모·지연·동시 검색 부하는 합성 단위 테스트와 정적 QA만으로 대체할 수 없습니다.
- `main` merge는 Production 자동 배포를 유발할 수 있습니다. 자동 상태만 관찰하며 수동 Promote·재배포하지 않습니다.
