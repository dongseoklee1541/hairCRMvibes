---
id: doc-23
title: astra-feedback-release-2026-09-28
type: other
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 15:04'
tags:
  - migrated
  - dated-source
---
# 이관 안내 — doc-23

기능 계약·설계·날짜별 검증/배포/관찰/감사 근거를 전체 이관했다. 아래 `상태`·`현재`·`다음 행동`·승인 문구와 경로는 원문 기록 시점의 사실/제안/계획이다. 현재 상태·다음 행동의 원본은 연결 task/Draft이며 원문에 과거 미완료가 있어도 완료된 구현을 재실행하지 않는다.

- 원래 경로: `docs/roadmap/astra-feedback-release-2026-09-28.md` (역사적 식별자)
- 이관일: 2026-09-29 KST; 실제 구현·검증은 원래 날짜 유지, 이번 이관에서 재실행하지 않음
- 원문 기준 commit: `b095a7546a16169b6706ab8b520b1e38c7776f14`
- 원문 SHA-256: `5b05e36b5e2173052ccb7e09560f48ab41619f8563c44d07c5a6154a87c573b1`
- 작업: [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md), [TASK-10](../../tasks/task-10%20-%20R-10-%EC%A7%81%EC%9B%90-%EC%B4%88%EB%8C%80%C2%B7%EC%97%AD%ED%95%A0-%EA%B4%80%EB%A6%AC-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md), [TASK-14](../../tasks/task-14%20-%20R-14-%EC%89%AC%EC%9A%B4-%EC%82%AC%EC%9A%A9%EC%84%B1-%EA%B8%B0%EB%B0%98-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md), [TASK-17](../../tasks/task-17%20-%20R-10-%EC%8B%A4%EC%A0%9C-owner-staff-%EA%B2%80%EC%A6%9D%EA%B3%BC-%EC%B4%88%EB%8C%80-%ED%99%9C%EC%84%B1%ED%99%94-gate.md), [TASK-18](../../tasks/task-18%20-%20R-14-%EB%8C%80%ED%91%9C-%EC%82%AC%EC%9A%A9%EC%9E%90-2%EB%AA%85-%EA%B4%80%EC%B0%B0.md), [TASK-25](../../tasks/task-25%20-%20PWA-%EA%B3%A0%EC%A0%95-URL-precache%C2%B7%EB%93%B1%EB%A1%9D-%EC%B0%A8%EB%8B%A8-%ED%99%98%EA%B2%BD-%ED%9B%84%EC%86%8D.md)
- 관리 절차: [doc-41](../operations/doc-41%20-%20backlog-workflow.md)

문서/이미지/SQL/증거 Markdown 링크는 이 문서 위치 기준으로 수정했다. 코드 블록과 backtick의 역사적/저장소 루트 경로는 그대로 유지하며 과거 명령을 현재 승인으로 해석하지 않는다.

<!-- migrated-source:start -->
# Astra 피드백 운영 배포·검증 — 2026-09-28

## 배포 근거

- [PR #44](https://github.com/dongseoklee1541/hairCRMvibes/pull/44) 병합: `df950f61a1bf6b7a770e49abb3c9c47f15e48e27`, 2026-09-28 20:15:31 KST.
- 검토 head: `0218d5cdd8e2c6d50cc6d64aa3c4a5f0f9fc43ea`. [PR CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/36414395336)와 [main CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/36414584312) 성공. Node·R-10 서버 계약·Jest와 새 PostgreSQL ACL/schema/R-10 SQL/동시성 검사 및 build를 포함합니다.
- Git 연동 [Vercel 배포](https://vercel.com/dongseoklee1541s-projects/hair-cr-mvibes/336UvzixaL1shC4kjP5d5vv8wuun) status success. [운영 URL](https://hair-cr-mvibes.vercel.app/login)에서 새 UI를 직접 확인했습니다.
- 최초 push의 HTTP400은 명령 단위 HTTP/1.1·postBuffer 조정 후 해소했습니다. 인증 설정은 바꾸지 않았습니다.

## 운영 확인

새 비인증 Chrome context에서 390×844·360×800을 검증했습니다. 실제 계정 정보는 입력하지 않았고 고객·직원 데이터나 초대 설정은 변경하지 않았습니다.

- `/login`: HTTP200, 이메일 label과 `login-email` 연결, 비밀번호 보기/숨기기 정상, 버튼 높이44px, 가로 overflow 없음.
- `/api/staff`: 미인증 GET에 HTTP401, Cache-Control=`no-store, max-age=0`.
- `/settings/team`: 비인증 접근 시 `/login?from=...` 이동.
- 기본 서비스워커 허용 조건에서 pageerror 0.

[운영 검증 JSON](../../../output/playwright/astra-release-20260928/production-verification.json), [390×844 화면](../../../output/playwright/astra-release-20260928/production_login_390x844.png), [360×800 화면](../../../output/playwright/astra-release-20260928/production_login_360x800.png)을 보존했습니다. 검증 시각은 JSON의 UTC 값을 기준으로 합니다.

## 한계와 잔여

- 자동화에서 serviceWorkers를 강제로 block한 초기 조건에서는 `Cannot read properties of undefined (reading 'waiting')`가 관찰됐습니다. 기본 allow 조건의 새 컨텍스트에서는 두 viewport 모두 재현되지 않았습니다. [초기 오류 기록](../../../output/playwright/astra-release-20260928/page-errors.json)을 남겼으며, 등록이 차단되는 환경의 추가 방어는 이번 배포로 해결됐다고 주장하지 않습니다.
- 실제 owner/staff 로그인·쓰기, 메일 발송, 대표 사용자 관찰, 실제 기기 IME·설치형 PWA 검증은 미실행·기존 보류를 유지합니다. 인증 후 변경 화면은 [합성 로컬 회귀](doc-24%20-%20astra-feedback-remediation-2026-09-27.md)와 구분합니다.
- 이번 배포는 코드·설계·문서·검사 설정입니다. 운영 초대 flag·계정·권한·DB migration을 추가 변경하지 않았습니다.
- 배포 증거 문서의 후속 병합은 앱 소스를 변경하지 않습니다. 해당 후속의 CI·배포 상태는 별도로 확인하되 같은 공개 UI 검증을 근거 없이 반복하지 않습니다.

<!-- migrated-source:end -->
