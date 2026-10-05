---
id: decision-13
title: R-09-stats-aggregate-rpc
date: '2026-10-02 06:50'
status: accepted
---

# R-09 통계 집계 RPC 선택

기존 확정 결정의 누락 이관 보완일: 2026-10-02 KST. 원래 선택·구현 근거는 2026-07-12 R-09 release 기록(PR #20, main@b63f9a3771409776593c6ad61727e24c68082186)이다. native 생성 날짜는 원래 결정일을 대신하지 않는다. 새로운 설계 선택이나 운영 변경 승인을 추가하지 않는다.

## 선택과 비교한 대안

기간 검증과 정해진 KPI를 한 번에 반환하는 집계 RPC get_stats_summary를 선택했다. 비교한 view 방식은 임의 기간 필터와 원본 row 조합을 허용하므로 RPC가 반환 데이터와 권한 경계를 좁힌다는 원문의 이유를 보존한다. 이전 브라우저 원본 집계 제거는 구현 결과다.

## 확정 제약과 권한 경계

- 기간 검증과 의미가 확정된 KPI를 한 번에 반환하는 aggregate RPC를 선택했습니다. 임의 기간 필터와 raw row 조합을 허용하는 view보다 반환·권한 경계가 좁습니다.
- 함수는 `STABLE SECURITY INVOKER`, 빈 `search_path`, 완전 수식 테이블명을 사용합니다.
- 함수 내부에서 `auth.uid()`와 `profiles.role in ('owner','staff')`를 확인합니다. 현재 appointment/service 가격은 두 역할 모두 읽을 수 있어 owner/staff 동일 집계를 허용했습니다.
- `PUBLIC`, `anon`, `authenticated`의 기본 EXECUTE를 모두 회수한 뒤 `authenticated`에만 명시적으로 부여합니다. profile이 없거나 허용 역할이 아니면 `42501`로 차단합니다.
- 응답에는 고객 ID·이름·전화번호·메모와 예약 ID·원본 row가 없습니다.
- 범위가 최대 366일이고 현재 데이터 규모에서 별도 index 근거가 없어 index를 추가하지 않았습니다.

## 계약 버전과 증거

KST inclusive 기간·최대366일 및 최소 집계 응답은 원래 RPC 계약이다. 초기 price_snapshot_krw 매출 정의는 당시 이력이며, 현재 실제 매출 의미는 R-15에서 확정된 actual_price_krw 계약을 따른다. owner/staff/profileless/anon/PUBLIC의 SQL fixture·catalog/ACL 기록과 실제 Production 로그인 집계의 미검증을 구분한다.

- [원문 doc-10](../docs/features/doc-10%20-%20R-09-stats-advanced.md)
- [최신 매출 결정 decision-7](decision-7%20-%20R-09-and-R-15-revenue-contract.md)
- [TASK-9](../tasks/task-9%20-%20R-09-%ED%86%B5%EA%B3%84-%EA%B3%A0%EB%8F%84%ED%99%94.md)
- [역할별 후속 TASK-23](../tasks/task-23%20-%20%EC%99%84%EB%A3%8C-%EA%B8%B0%EB%8A%A5%EC%9D%98-%EC%8B%A4%EC%A0%9C-%EC%97%AD%ED%95%A0%EB%B3%84-UI%C2%B7%EC%9A%B4%EC%98%81-%EC%93%B0%EA%B8%B0-%EA%B2%80%EC%A6%9D-%EA%B3%B5%EB%B0%B1.md)
