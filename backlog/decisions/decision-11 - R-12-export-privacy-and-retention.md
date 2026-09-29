---
id: decision-11
title: R-12-export-privacy-and-retention
date: '2026-09-29 14:45'
status: accepted
---

# R-12-export-privacy-and-retention

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

owner 데이터 export·no-store·CSV 계약·보관 정책을 보존한다. CSV는 전체 DB disaster recovery를 대체하지 않는다. 불명확한 비교 대안은 임의로 발명하지 않으며 원문에 없으면 미기록으로 남긴다.

원문 결정·비교·제약: [docs/roadmap/R-12-csv-export-backup.md](../docs/features/doc-14%20-%20R-12-csv-export-backup.md)

<!-- migrated-decision:start -->
## 개인정보·권한·보관 경계
- `/api/export`는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 요청 사용자의 Bearer JWT만 사용합니다. service-role/secret key를 읽거나 사용하지 않습니다.
- `auth.getUser(token)` 검증, 본인 `profiles.role='owner'` 확인, 기존 Supabase RLS를 모두 통과해야 내보낼 수 있습니다. UI의 owner 제한만 권한 경계로 신뢰하지 않습니다.
- 응답은 `private, no-store`, `Pragma: no-cache`, `Vary: Authorization`, `nosniff`, same-origin CORP를 사용합니다.
- 서버·브라우저 저장소에 CSV를 보관하지 않습니다. File System Access API를 지원하는 브라우저는 사용자가 선택한 파일로 응답을 직접 스트리밍하고, 미지원 브라우저는 Blob URL을 클릭 직후 해제합니다. localStorage, IndexedDB, Cache Storage에는 고객 데이터를 쓰지 않습니다.
- 운영 이관·점검용 전체 행 내보내기이므로 CSV에는 고객 연락처·메모와 예약 메모가 포함됩니다. 화면에서 이를 경고하고 접근이 제한된 위치에 보관하도록 요구합니다. Auth·스키마·시점복구를 포함하는 재해복구 백업은 아닙니다.
- staff는 `403 OWNER_REQUIRED`, 미인증·만료 세션은 `401`, 허용하지 않은 데이터셋은 `400`으로 거부합니다. 오류 응답과 서버 로그에는 Supabase 상세 오류나 고객 데이터가 포함되지 않습니다.
- 파일 취급 기준은 [`docs/operations/csv-backup-handling.md`](../docs/operations/doc-33%20-%20csv-backup-handling.md)에 고정했습니다. 기기 암호화 저장소로 즉시 이동하고 최대 30일 이내에 다운로드 폴더·휴지통·클라우드 사본까지 삭제합니다.


## CSV 계약
- 고객 파일: 고객 식별자, 이름, 전화번호/정규화 번호, 메모, 생성·수정, archive/merge/anonymize 감사 필드를 고정 순서로 내보냅니다.
- 예약 파일: 예약·고객 식별자, 날짜/시간, 서비스 snapshot, 소요시간, 가격 snapshot, 메모, 상태, 생성·수정·취소 감사 필드를 고정 순서로 내보냅니다.
- UTF-8 BOM, CRLF, 모든 셀 큰따옴표 인용을 사용합니다.
- `=`, `+`, `-`, `@`, tab/CR/LF 및 공백 뒤 수식 기호로 시작하는 값 앞에 작은따옴표를 붙여 spreadsheet formula injection을 방어합니다.
- PostgREST 조회는 변경되지 않는 `created_at`, `id` 순서로 1,000행 단위의 결정적 페이지네이션을 사용합니다. 첫 페이지를 응답 전에 조회해 즉시 발생한 권한·조회 오류는 JSON으로 반환하고, 이후 페이지는 한 번에 한 페이지만 메모리에 두고 순서대로 CSV 스트림에 추가합니다.
- 여러 HTTP 조회를 하나의 데이터베이스 snapshot transaction으로 묶지는 않으므로 대량 내보내기 중 편집은 피해야 합니다. 불변 정렬키는 일반적인 예약 날짜·시간 수정이 페이지 경계를 바꾸는 위험을 줄이지만, 이 CSV를 시점복구 백업으로 만들지는 않습니다.
- 애플리케이션 행 수 상한은 두지 않습니다. 실제 최대 처리량은 Vercel 함수 실행 시간, Supabase 응답 시간, 네트워크와 미지원 브라우저의 Blob 메모리에 의해 제한됩니다.
- 파일명 날짜는 공통 KST helper를 사용해 `haircrm_<dataset>_YYYY-MM-DD.csv`로 생성합니다.
<!-- migrated-decision:end -->
