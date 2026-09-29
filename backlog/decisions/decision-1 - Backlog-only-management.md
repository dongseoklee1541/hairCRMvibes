---
id: decision-1
title: Backlog-only-management
date: '2026-09-29 14:45'
status: accepted
---

# Backlog-only-management

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

사용자의 2026-09-29 요청으로 기존 병행 관리와 거대 task 병합 대안을 배제하고 작업은 native task, 계약/근거는 doc, 확정/제안은 decision, 미승인 후보는 Draft로 분리한다. 로컬 devDependency 고정·자동 commit/remote/callback 비활성화·기존 hook 보존을 선택했다. 전역 설치/MCP/게시/배포/운영 변경은 범위 밖이다.

근거: [doc-43](../docs/migration/doc-43%20-%20backlog-migration-20260929.md); [doc-41](../docs/operations/doc-41%20-%20backlog-workflow.md)
