---
id: doc-37
title: pencil-desktop-workflow
type: guide
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 15:04'
tags:
  - migrated
  - operations
---
# 이관 안내 — doc-37

반복 실행·검증·복구 절차의 새 관리 위치다. 원래 실행·적용 날짜는 본문을 따른다. 아래 원문의 옛 상태 관리 지시와 당시 결과는 날짜가 있는 이관 기록이며 새 기록 방식은 [doc-41](doc-41%20-%20backlog-workflow.md)를 따른다. 검증된 절차 개선은 이 native doc를 CLI로 갱신한다.

- 원래 경로: `docs/operations/pencil-desktop-workflow.md` (역사적 식별자)
- 이관일: 2026-09-29 KST; 실제 구현·검증은 원래 날짜 유지, 이번 이관에서 재실행하지 않음
- 원문 기준 commit: `b095a7546a16169b6706ab8b520b1e38c7776f14`
- 원문 SHA-256: `b3e3155b234fcd518bbbd72ad99789aa11b381a437e632e13866f95a0990187e`
- 작업: [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md), [TASK-14](../../tasks/task-14%20-%20R-14-%EC%89%AC%EC%9A%B4-%EC%82%AC%EC%9A%A9%EC%84%B1-%EA%B8%B0%EB%B0%98-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md)
- 관리 절차: [doc-41](doc-41%20-%20backlog-workflow.md)

문서/이미지/SQL/증거 Markdown 링크는 이 문서 위치 기준으로 수정했다. 코드 블록과 backtick의 역사적/저장소 루트 경로는 그대로 유지하며 과거 명령을 현재 승인으로 해석하지 않는다.


## 현재 운영 결과 기록 규칙 — 2026-09-29

이 절차의 실행 계획·승인 범위·상태·진행/검증·다음 행동은 해당 native task에 기록합니다. 날짜·commit·환경·명령·결과·증거와 미검증/보류/차단은 task notes와 연결한 evidence/release doc에 남깁니다. 실제 적용 상태는 task를 조회하고 연결 doc는 당시 근거로 읽습니다. 운영 방법 개선은 효과를 검증한 뒤 이 doc의 절차를 갱신합니다. 원문에 남은 future-todo/roadmap 동기화 문구는 2026-09-29 종료된 역사적 규칙이며 실행하지 않습니다.

<!-- migrated-source:start -->
# Pencil / Pen Desktop 작업 절차

설계 SSOT와 micro-fix 예외 기준은 [AGENTS.md](../../../AGENTS.md)의 §5를 따릅니다. 연결 상태와 도구 목록은 세션마다 확인하며 과거 오류를 현재 차단으로 단정하지 않습니다.

## MCP 우선 경로

1. 현재 제공된 MCP 도구 목록과 설치된 앱을 확인합니다. 앱 이름은 Pen.app일 수 있습니다. 예전 `get_editor_state`·`batch_design` 이름을 현재 도구로 가정하지 않습니다.
2. 현재 `get_app_state` 도구에는 대상 `.pen` 절대 경로를 `filePath`로 명시하고 반환된 활성 파일을 확인합니다. 파일이 없는 오류를 앱 미설치·연결 실패와 구분합니다. 다른 세션 문서를 바꾸지 않습니다.
3. `read_skill()`과 그 문서의 `execute.md`·`pen-schema.md`를 한 번 읽습니다. 현재 계약에 맞는 `execute({filePath,input})`의 `Get`·`Update`·`Copy` 등을 사용합니다. `.pen` 직렬화 내용은 직접 읽거나 편집하지 않습니다.
4. 필요한 화면·부품만 읽고 작은 변경 단위로 진행합니다. 기존 디자인을 우선 재사용하며 전체 문서 덤프·모든 하위 노드 일괄 변경을 피합니다. 오류가 나면 같은 실패를 반복하지 말고 대상 한 개와 현재 bounds부터 확인합니다.
5. 구조 검사는 `Get` visitor의 bounds/problems로, 시각 검사는 완성된 화면/영역의 `TakeScreenshot`으로 구분합니다. 모든 호출에 스크린샷을 붙이지 않습니다. 수정 중인 root의 placeholder 상태는 완료 전에 해제하지 않습니다.
6. MCP의 변경 성공은 디스크 저장 성공이 아닙니다. Desktop File → Save 후 파일 hash·diff와 필요 시 재열기 확인까지 수행합니다. 저장 API가 없을 때만 native UI를 사용합니다. 메뉴가 열려 단축키가 전달되지 않으면 해당 메뉴를 닫고 File → Save를 선택합니다.

## 오류·업데이트 진단

- `transport not connected`는 앱 실행·파일 열림·MCP 설정을 확인하고, 실제 실행 환경의 제한과 앱 오류를 구분합니다. 추측으로 토큰/설정/프로필을 바꾸지 않습니다.
- 배경만 나오는 스크린샷, 클리핑, 예상과 다른 좌표는 기존 정상 노드와 새 최소 사례를 비교합니다. 이미지가 비어 있으면 검증 증거로 쓰지 않습니다. 전체 좌표를 일괄 보정하지 않습니다.
- 버전 문제 가능성이 있으면 설치 앱 버전과 MCP 실행 경로, 앱의 업데이트 메뉴를 확인합니다. 앱 내장 MCP인지 별도 설치인지 먼저 구분하며, 앱 업데이트가 항상 문제를 해결한다고 단정하지 않습니다.
- 재시작·업데이트 전에 원본과 작업 중 파일을 백업·명시 저장합니다. 업데이트 후 같은 최소 사례로 재검증하고 필요하면 MCP 클라이언트를 재연결합니다. 버전별 변경 내역이 없으면 해결 여부는 미확인으로 남깁니다.
- 자동 승인 검토가 조작을 거절하면 실행하지 않고 이유를 알립니다. 읽기 검사나 대상 한 개의 안전한 수정으로 범위를 줄일 수 있는지 판단하며, 거절된 조작을 다른 경로로 우회하지 않습니다.
- 설계 연결·저장·레이아웃 검증이 끝나지 않으면 material UI 작업을 완료 처리하지 않습니다. 승인된 독립 서버·테스트 작업은 계속하며, SSOT 예외가 필요하면 실제 차단 원인과 정확한 범위를 제시합니다.

공식 근거: [MCP 연결](https://docs.pencil.dev/getting-started/ai-integration), [버전·업데이트](https://docs.pencil.dev/getting-started/installation), [저장·문제 해결](https://docs.pencil.dev/troubleshooting). 2026-09-27 확인. 앱/MCP 갱신 뒤에는 현재 도구 계약을 다시 확인합니다.

<!-- migrated-source:end -->
