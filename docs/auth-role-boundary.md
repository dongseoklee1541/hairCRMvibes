# Auth / Role Boundary

## 목적

권한 관련 회귀가 다시 발생하지 않도록 현재 화면 경계를 문서로 고정합니다.

## 현재 규칙

- 인증이 아직 준비되지 않았으면 보호 화면 대신 로딩 상태를 유지합니다.
- 로그인하지 않은 사용자는 `AuthGate`에서 `/login`으로 리다이렉트됩니다.
- `allowedRoles`가 있는 화면은 역할이 확인된 뒤에만 렌더링됩니다.
- 역할 조회 실패(`roleLoadError`) 시 일반 권한 없음 화면이 아니라 로그아웃 복구 흐름을 보여줍니다.
- `TabBar`는 역할이 확정되기 전에는 숨겨지고, `staff`에게는 설정 탭을 노출하지 않습니다.

## 관련 파일

- `components/AuthProvider.js`
- `components/AuthGate.js`
- `components/ForbiddenView.js`
- `components/TabBar.js`

## 검증 포인트

- `ForbiddenView`는 기본적으로 링크 액션을 사용해야 합니다.
- 역할 복구 흐름에서는 버튼 액션과 `onAction` 콜백을 사용해야 합니다.
- `AuthProvider`는 실패 시 `roleLoadError`를 올리고 임의 역할을 주입하지 않아야 합니다.
- `TabBar`는 역할 조회 실패나 미확정 상태에서 렌더링되면 안 됩니다.
