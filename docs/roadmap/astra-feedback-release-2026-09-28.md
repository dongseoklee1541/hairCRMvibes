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

[운영 검증 JSON](../../output/playwright/astra-release-20260928/production-verification.json), [390×844 화면](../../output/playwright/astra-release-20260928/production_login_390x844.png), [360×800 화면](../../output/playwright/astra-release-20260928/production_login_360x800.png)을 보존했습니다. 검증 시각은 JSON의 UTC 값을 기준으로 합니다.

## 한계와 잔여

- 자동화에서 serviceWorkers를 강제로 block한 초기 조건에서는 `Cannot read properties of undefined (reading 'waiting')`가 관찰됐습니다. 기본 allow 조건의 새 컨텍스트에서는 두 viewport 모두 재현되지 않았습니다. [초기 오류 기록](../../output/playwright/astra-release-20260928/page-errors.json)을 남겼으며, 등록이 차단되는 환경의 추가 방어는 이번 배포로 해결됐다고 주장하지 않습니다.
- 실제 owner/staff 로그인·쓰기, 메일 발송, 대표 사용자 관찰, 실제 기기 IME·설치형 PWA 검증은 미실행·기존 보류를 유지합니다. 인증 후 변경 화면은 [합성 로컬 회귀](./astra-feedback-remediation-2026-09-27.md)와 구분합니다.
- 이번 배포는 코드·설계·문서·검사 설정입니다. 운영 초대 flag·계정·권한·DB migration을 추가 변경하지 않았습니다.
- 배포 증거 문서의 후속 병합은 앱 소스를 변경하지 않습니다. 해당 후속의 CI·배포 상태는 별도로 확인하되 같은 공개 UI 검증을 근거 없이 반복하지 않습니다.
