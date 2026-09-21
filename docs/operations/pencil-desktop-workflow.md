# Pencil Desktop 작업 절차

설계 SSOT와 micro-fix 예외 기준은 [AGENTS.md §5](../../AGENTS.md#5-디자인과-mobile-ux)를 따릅니다. 이 문서는 연결·저장·복구 절차이며, 과거 연결 실패를 현재 장애로 간주하지 않습니다.

1. Pencil Desktop이 실행 중이고 의도한 `pencil-hairshopcrm.pen`이 열려 있는지 절대 경로로 확인합니다. VS Code 확장 MCP 경로와 혼용하지 않습니다.
2. MCP 초기화 뒤 Desktop handshake를 위해 1–2초 기다리고 `get_editor_state(include_schema: true)`를 호출한 다음 다른 Pencil 도구를 사용합니다.
3. Pencil은 공유 앱이므로 워크트리가 달라도 동시 편집하지 않습니다. 다른 세션의 활성 문서를 바꾸지 않습니다.
4. `batch_design` 뒤 예상 node의 존재와 `snapshot_layout`을 확인합니다.
5. Desktop의 File > Save로 저장하고, 같은 절대 경로의 파일 hash·Git diff가 변경됐는지 확인합니다. 도구 응답 성공만으로 저장 완료를 선언하지 않습니다.
6. `export_nodes` PNG가 배경만 있거나 비어 보이면 앱 canvas와 대조합니다. 유효하지 않은 export는 검증 증거로 사용하지 않습니다.

## 연결·좌표 문제

- `Transport closed`는 Desktop socket → 중복 MCP 프로세스 → sandbox socket 접근 순으로 진단합니다. 실제 sandbox 제한이 확인될 때만 필요한 권한을 요청합니다.
- 50px insert-coordinate offset이 의심되면 최소 사례로 재현하고 전역 좌표 보정을 추정 적용하지 않습니다.
- 연결이나 디스크 저장이 불안정하면 해당 설계 단계의 차단 원인으로 기록합니다. 사용자가 구체적 SSOT 예외를 승인하기 전에는 다른 mock으로 대체하거나 material UI 변경을 완료 처리하지 않습니다.
- 과거 node ID·hash는 당시 증거입니다. 후속 작업에서는 실제 열린 파일과 필요한 node만 확인하고, 변경 없는 전체 설계를 다시 만들지 않습니다.
