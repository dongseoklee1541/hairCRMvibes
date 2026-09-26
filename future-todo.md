# Hair CRM Future TODO Roadmap

## 문서 목적

- 이 문서는 Hair CRM의 차후 개발 우선순위를 고정하고, 구현 착수 전 의사결정을 빠르게 하기 위한 로드맵입니다.
- 본 문서는 현재 상태·다음 행동과 상대적 실행 순서(Phase)를 관리합니다. 완료 근거와 과거 기록은 로드맵 상세 문서에 둡니다.
- 범위는 워크스페이스 코드베이스와 `pencil-hairshopcrm.pen` 분석 결과를 기반으로 한 정식 로드맵 16개와 번호 미배정 사용성 후보 3개입니다.

## 현재 기준 (2026-09-26 KST 점검)

- 로컬 `main`과 GitHub `main`: `a8ce41478891ce249b596fa1528aab5de1ec157d` (계정 도구 PR #42 병합). PR·병합 후 CI와 Vercel 검사 success를 확인했습니다. 이 값은 점검 시점 기록이며 다음 세션 시작 시 다시 확인합니다.
- PR #39 금액 입력 수정은 병합·Production 배포 성공 기록 확인. PR #40 Astra·브라우저 작업 지침도 병합 완료입니다. 상세 근거와 확인 한계는 [문서 점검 기록](./docs/roadmap/documentation-audit-2026-09-22.md)을 따릅니다.
- 2026-09-26 Supabase Production·Preview의 Auth URL·Advisor와 R-10 함수/권한/RLS catalog를 읽기 전용 확인했습니다. [보안 점검 결과와 변경안](./docs/roadmap/security-audit-2026-09-26.md)을 참고합니다. 이후 승인된 Auth URL 설정은 양 환경에 적용·재조회 완료했으며 DB 권한·데이터는 변경하지 않았습니다. 실제 owner/staff 동작과 Vercel 초대 flag 값·canonical alias·실기기는 미검증입니다.

- 2026-09-27 후속: 사용자 승인으로 ACL migration을 양 환경에 적용했습니다. Production의 대상 함수 실행 권한과 Advisor 경고 해소를 확인했으며, 함수·트리거·사용자 데이터는 보존했습니다. 위 09-26의 DB 권한 미변경은 준비 시점 기록입니다.

## 우선순위 기준

- `P0`: 보안/데이터 보호, 예약 운영 연속성, 운영 중단 리스크를 직접 줄이는 항목
- `P1`: 운영 효율과 품질(사용성/통계/데이터 일관성) 고도화 항목
- `P2`: 확장성/자동화/관리 편의성 중심의 중장기 항목

## 정식 기능 리스트 (16개)

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
| R-14 | 쉬운 사용성 1차(가독성·조작성 기반) | P1 | 50~60대 여성 사용자를 중심으로 핵심 화면의 글자, 용어, 버튼, 폼 피드백을 쉽게 정비 | 핵심 운영 화면 현황과 대표 사용자 검증 기준 | 오조작과 학습 부담 감소, 예약·고객 업무 자신감 향상 | M |
| R-15 | 고객별 실제 시술금액 입력·수정 | P1 | 서비스 기본가격 snapshot과 고객에게 실제 적용한 금액을 분리해 예약·고객 이력에서 입력·수정 | R-08, R-09 실제 매출 계약 | 고객별 실제 가격 이력과 매출 데이터 품질 향상 | M |
| R-16 | 고객별 횟수권 | P1 | 고객별 총 횟수와 예약별 사용 원장을 두고 예약 확정 시 차감·취소 시 복구·잔여 조회 | R-02, R-07, R-08, R-15 | 패키지 운영의 잔여 오류와 수기 관리 감소 | L |
| R-10 | 권한관리 UI(직원 초대/권한변경) | P2 | 원장이 직원 계정의 역할을 UI에서 관리 가능하게 구성 | R-01, 초대 흐름 합의 | 운영 권한 관리 비용 절감 | L |
| R-11 | 알림 자동화(예약 리마인드/재방문) | P2 | 공통 dry-run/outbox 위에 고객 SMS·직원 PWA Push·동의 기반 재방문 채널을 단계적으로 구성 | R-02, R-08, R-10, provider·법적 gate | 노쇼 감소, 운영 확인 자동화, 재방문율 상승 | L |
| R-12 | CSV 내보내기/백업 | P2 | 고객/예약 데이터 내보내기 및 운영 백업 지원 | 개인정보 마스킹/보관 정책 | 운영 안정성 및 데이터 이관 용이성 향상 | M |

## 번호 미배정 사용성 후보 (3개)

아래 항목은 정식 R 업무가 아니며 번호를 예약하지 않습니다. R-14 구현과 대표 사용자 검증 결과를 본 뒤 별도 승인을 거쳐 필요한 항목만 당시의 다음 사용 가능 R 번호로 승격합니다.

| 구분 | 기능 | 상태 | 판단 목적 | 상세 문서 |
| --- | --- | --- | --- | --- |
| 후보 A | 오늘 예약 중심 홈 | Candidate (ID 미배정) | 첫 화면에서 고객 목록보다 당일 일정 확인이 우선인지 검증 | [candidate-today-centered-home.md](./docs/roadmap/candidate-today-centered-home.md) |
| 후보 B | 지난 시술 그대로 재예약 | Candidate (ID 미배정) | 고객 이력에서 반복 예약을 시작하면 입력 부담이 실제로 줄어드는지 검증 | [candidate-repeat-last-service.md](./docs/roadmap/candidate-repeat-last-service.md) |
| 후보 C | 예약 등록 완료 확인 강화 | Candidate (ID 미배정) | 저장 직후 명확한 요약과 다음 행동이 중복 입력·불안을 줄이는지 검증 | [candidate-appointment-save-confirmation.md](./docs/roadmap/candidate-appointment-save-confirmation.md) |

## 단계별 실행 계획

### Phase 1 (P0 안정화)

- `R-01` RLS 정책 정리
- `R-02` 예약 수정·취소·상태변경
- `R-03` 더블부킹/영업시간 충돌 방지
- `R-04` 날짜·시간대 정합성 개선
- `R-05` 설정 페이지 실구현

## 구현 상태

아래 상태는 각 상세 문서의 완료 범위를 요약합니다. `Done`도 별도 후속 검증까지 통과했다는 뜻은 아닙니다. 날짜 없는 과거 검증을 이번 점검에서 재실행한 것으로 해석하지 않습니다.

| ID | 상태 | 완료·진행 근거 | 다음 행동 / 남은 범위 |
| --- | --- | --- | --- |
| [R-01](./docs/roadmap/R-01-rls-policy.md) | Done | RLS·grant, live/fresh role 검증 완료 기록 | 신규 profile provisioning·advisor 후속은 별도 보안 작업 |
| [R-02](./docs/roadmap/R-02-appointment-edit-cancel-status.md) | Done | 상태 RPC·모바일 검증, R-16 release에 취소 확인 보완 포함 | 새 결함·요구가 없으면 완료 검증을 반복하지 않음 |
| [R-03](./docs/roadmap/R-03-booking-conflict-business-hours.md) | Done | 예약 guard·동시성·PostgreSQL replay 완료 기록 | full Supabase reset·대량 부하는 미검증; 필요 시 환경부터 확인 |
| [R-04](./docs/roadmap/R-04-kst-date-time-consistency.md) | Done | KST 공통 유틸·경계 단위 테스트·모바일 검증 기록 | 전체 timezone/time-travel·실기기 장시간 실행은 미검증 |
| [R-05](./docs/roadmap/R-05-settings-page.md) | Done | 설정 UI·live owner/staff/anon 경계 검증 기록 | staff 설정 UI·실기기 SW update는 후속 미검증 |
| [R-06](./docs/roadmap/R-06-pwa-completion.md) | Done | 로컬 PWA·cache·Production 공개 자산 검증 기록 | 실기기 설치/standalone/SW update는 보류; 고정 URL precache 갱신 정책은 후속 |
| [R-07](./docs/roadmap/R-07-customer-edit-delete-dedupe.md) | Done | Phase 1·R-07 통합 release, DB·role smoke·Production 기록 | post-deploy owner/staff UI·체감 속도는 미검증 |
| [R-08](./docs/roadmap/R-08-service-master.md) | Done | PR #16·migration·role/snapshot transaction·Production 기록 | 실제 로그인 owner/staff UI·운영 초기 가격 입력은 별도 범위 |
| [R-13](./docs/roadmap/R-13-appointment-customer-search-quick-create.md) | Done | PR #18·Production 공개/PWA·합성 모바일 검증 기록 | 실제 owner/staff UI는 미검증, 실기기 IME/standalone은 보류 |
| [R-09](./docs/roadmap/R-09-stats-advanced.md) | Done | PR #20·migration/ACL·Production 공개/PWA 기록 | Production authenticated stats는 미검증 |
| [R-14](./docs/roadmap/R-14-easy-usability-foundation.md) | In Progress (구현 완료 · 대표 사용자 검증 대기) | PR #25·Production 기록, 대표 사용자 결과 없음 | 대표 사용자 2명 관찰을 별도 일정·범위로 정한 뒤 판정; 자동 재개하지 않음 |
| [R-15](./docs/roadmap/R-15-customer-service-price.md) | Done (PR #39 병합·Production 배포 기록 확인) | PR #34 원기능 + #39 입력 수정. 2026-09-22 GitHub 병합·CI·Production success 재확인, Preview owner 검증 기록 보존 | staff UI·Production authenticated stats는 미검증. 모바일 로그인 조사·실기기 IME·설치형 PWA는 사용자 보류 |
| [R-16](./docs/roadmap/R-16-customer-session-pass.md) | Done | 2026-09-11 PR #37·Production DB/배포·로그인 조회 완료 기록 | Production 쓰기·staff 별도 로그인은 미검증; 실기기 IME/PWA는 보류 |
| [R-10](./docs/roadmap/R-10-role-management.md) | In Progress (보안 경고·owner 검증 잔여) | PR #26 migration·배포 완료 기록. 2026-09-26 양 환경 Auth URL 적용·재조회 완료. RPC 6개 본문·ACL·private 원장 접근 차단 확인 | ACL migration 양 환경 적용·권한 검증·대상 Advisor 경고 해소 완료 → 잔여 운영 정책·합성 owner 검증. Vercel Production 설정 flag=false 재확인; 실제 owner/staff smoke는 미검증 |
| [R-11](./docs/roadmap/R-11-notification-automation.md) | Design Ready (설계 완료 · 구현 보류) | PR #31 설계 병합 기록; 저장소에 구현 추가 근거 없음 | 명시적 재개 시 최신 계약을 확인하고 dry-run 전용 foundation 범위 승인 |
| [R-12](./docs/roadmap/R-12-csv-export-backup.md) | Done | PR #22·Preview 역할/모바일/PWA·Production 공개/API 기록 | 대량 export 부하·모바일 Blob 메모리는 미검증; Production 실제 CSV 생성은 미실행 |

모바일 로그인 조사·실기기 키보드/IME·설치형 PWA 검증은 사용자 요청으로 **보류**합니다. 데스크톱 모바일 viewport·Preview owner 검증으로 대체 완료하거나 요청 없이 재개하지 않습니다. R-14 대표 사용자 검증과 R-10 운영 검증도 별도 범위이며 이번 문서 점검에는 포함하지 않았습니다.

교차 품질 개선은 [2026-07-16 기록](./docs/roadmap/ai-slop-remediation-2026-07-16.md), Phase 1·이전 release 이력은 [날짜별 보관본](./docs/roadmap/release-history-2026-07-to-09.md)을 참고합니다.

### Phase 2 (P1 운영 고도화)

R-06/R-07/R-08/R-13/R-09/R-15/R-16은 완료 범위를 재구현하지 않습니다. R-14는 대표 사용자 검증 대기입니다. 기능별 후속·보류 경계는 위 구현 상태 표를 따릅니다.

### Phase 3 (P2 확장)

R-12는 완료, R-10은 잔여 gate로 진행 중, R-11은 설계 완료·구현 보류입니다. 우선순위는 실행 승인이 아닙니다.

## 선행관계 맵

- `R-01 -> R-02 -> R-10`
- `R-05 -> R-03`
- `R-04 -> R-09`
- `R-08 -> R-09`
- `R-07 -> R-13 -> R-09` (실행 순서; R-13은 R-09 집계 계약을 변경하지 않음)
- `R-06 + R-13 -> R-14` (현재 모바일/PWA·예약 등록 흐름을 유지하면서 사용성 기반 정비)
- `R-08 + R-09 -> R-15` (서비스 기본가격 snapshot과 실제 적용 금액·통계 의미 분리)
- `R-02 + R-07 + R-08 + R-15 -> R-16` (예약 상태·고객 lifecycle·서비스 자격·가격 경계를 먼저 고정)
- `R-08 -> R-11`
- `R-10 -> R-11`
- `R-02 + R-03 -> R-11`

## 리스크 및 완화

- 우선순위 해석 차이: P0/P1/P2 기준(보안/운영중단/확장성)을 문서 상단에 고정합니다.
- 항목 중복 또는 누락: ID(`R-01`~`R-16`)를 고정하고 번호 미배정 후보는 별도 승인 전까지 R ID로 취급하지 않습니다.
- 문서 노후화: 상태가 바뀌면 확인 날짜·대상 환경·근거·남은 범위를 함께 갱신합니다.

## 확정된 방향과 남은 결정

- 예약 충돌은 [R-03](./docs/roadmap/R-03-booking-conflict-business-hours.md)의 저장 차단 계약으로 구현됐습니다. 기존 A/B 비교를 다시 결정할 필요는 없습니다.
- 알림은 [R-11](./docs/roadmap/R-11-notification-automation.md)의 목적별 채널 C안과 dry-run 전용 첫 단위가 설계상 확정됐습니다. 구현은 보류이며 provider·동의·SLA·live 보존 정책은 재개 시 별도 gate입니다.

## 업데이트 규칙

상태 표기·근거 재사용·상충 처리·세 문서 동기화는 [로드맵 인덱스의 갱신 규칙](./docs/roadmap/README.md#갱신-규칙)을 따릅니다. 기능 ID는 재사용하지 않고 후보 승격은 별도 승인 때 다음 번호를 부여합니다. 우선순위 변경 이유는 해당 상세 문서에 남깁니다.

## 마지막 업데이트

- 2026-09-26: PR #42 main 병합·동기화, R-01·R-10 운영 설정과 catalog 읽기 전용 점검. 이후 승인된 환경별 Auth URL을 적용·재조회 완료. 권한 정리 후보와 실제 owner 검증은 잔여.

- 2026-09-22: PR #39/#40 원격 근거 확인, R-10/R-14/R-11 잔여 상태와 보류 경계 정리, 오래된 누적 기록을 [release·감사 이력](./docs/roadmap/release-history-2026-07-to-09.md)으로 분리.
