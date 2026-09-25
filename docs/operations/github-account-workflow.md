# 저장소별 GitHub 계정 사용

이 저장소의 PR 명령과 Git HTTPS 인증이 같은 계정 프로필을 사용하도록 구성합니다. 기본 `gh` 프로필과 다른 저장소의 로그인은 바꾸지 않습니다. Git 게시 승인은 [AGENTS.md](../../AGENTS.md)의 범위를 따릅니다.

## 사용할 명령

```bash
git gh-account check
git gh-account pr list
git gh-account pr view 41
```

승인된 게시 작업에서는 `git gh-account pr create`, `git gh-account pr checks`, `git gh-account pr merge`를 사용합니다. `./scripts/gh-account`도 같은 명령을 지원하지만, 소스가 아직 없는 과거 워크트리에서는 Git alias를 사용합니다. 일반 `gh` 명령은 기존 기본 프로필을 사용하므로 이 저장소의 계정을 자동 선택하지 않습니다.

## 구성과 적용 범위

| 위치 | 역할 |
| --- | --- |
| 로컬 Git 설정 `haircrm.githubAccount` | 사용할 계정 이름 |
| 로컬 Git 설정 `haircrm.githubRepository` | 대상 `owner/repository` |
| 로컬 Git 설정 `haircrm.ghConfigDir` | 저장소 밖 전용 `gh` 설정 폴더의 절대 경로 |
| 로컬 Git alias `gh-account` | 설치된 전용 명령 실행 |
| Git 공통 디렉터리의 `haircrm-account/gh-account` | 브랜치 전환과 기존 워크트리에서도 유지되는 실행 사본 |
| [`scripts/gh-account`](../../scripts/gh-account) | 검토·버전 관리하는 실행 도구 소스 |

Git 공통 디렉터리는 `git rev-parse --git-common-dir`로 확인합니다. 로컬 설정은 같은 저장소의 연결된 워크트리에 공유되지만 다른 clone에는 복제되지 않습니다. 계정 매핑·프로필·실행 사본은 Git commit에 포함되지 않습니다. 새 clone에는 별도 초기 설정이 필요합니다.

원격 `origin`과 커밋 작성자 `user.name`/`user.email`은 변경하지 않습니다. 이 구성은 계정에 원격 권한을 부여하지 않습니다. 대상 계정의 실제 저장소 쓰기 권한을 별도로 확인합니다.

## 최초 로그인과 Git 인증 연결

먼저 사용자가 터미널에서 전용 프로필로 직접 로그인합니다.

```bash
haircrm_gh_profile="$(git config --local --get haircrm.ghConfigDir)"
GH_CONFIG_DIR="$haircrm_gh_profile" gh auth login --hostname github.com --git-protocol https --web
```

인증 화면에서 지정한 계정인지 확인합니다. Git 인증도 함께 설정할지 묻는 질문이 나오면 **No**를 선택해 전역 Git helper 변경을 피합니다. 토큰·비밀번호·인증 코드를 채팅이나 저장소에 붙여 넣지 않습니다. 인증정보 저장 위치는 `gh`의 정상 로그인 절차로 관리하며, 평문 저장 경고가 나오면 그대로 완료 처리하지 말고 저장소 접근 권한·credential store 상태를 확인합니다.

로그인이 끝난 뒤 실행합니다.

```bash
git gh-account check
git gh-account enable-git
```

`check`는 GitHub API의 실제 계정과 대상 저장소의 `permissions.push`를 확인합니다. 두 검사를 통과해야 `enable-git`이 로컬 credential helper·username·useHttpPath를 설정합니다. 최초 로그인 전에는 기존 helper를 유지합니다. 반복 실행해도 최초 복구용 백업을 덮어쓰지 않습니다.

Git helper는 지정한 HTTPS 호스트·저장소·계정에만 응답합니다. 자격증명은 `gh auth git-credential`이 Git에 직접 전달하며 이 실행 도구가 읽거나 파일에 저장하지 않습니다. 내부 `credential-helper` 명령을 터미널에서 직접 실행하거나 출력을 캡처하지 않습니다.

## 잘못된 계정 사용 방지

- 실제 로그인 계정 불일치, 쓰기 권한 없음, origin 변경은 게시 전에 차단합니다. 기본 계정·다른 helper·브라우저로 자동 대체하지 않습니다.
- `GH_TOKEN`/`GITHUB_TOKEN`이 전용 프로필을 덮어쓰는 환경이면 중단합니다. 토큰 값은 출력하지 않습니다.
- 네트워크/DNS/sandbox 오류와 실제 인증 오류, 403/404 접근 오류를 구분합니다. 네트워크가 제한된 환경의 실패만으로 재로그인을 요구하지 않습니다.
- 다른 저장소를 지정하는 `--repo`/`-R`, 외부 PR URL, 브라우저 `--web`/`-w`는 이 실행 경로에서 허용하지 않습니다. URL만으로 된 본문 등도 이 검사의 영향을 받을 수 있으므로 긴 PR 본문은 `--body-file`을 사용합니다.
- 이 명령은 안전한 계정 선택을 돕는 도구이며 시스템 전체의 접근 제어 장치는 아닙니다. 일반 `gh`, 명시적인 Git 설정 덮어쓰기, 직접 토큰 사용까지 차단한다고 주장하지 않습니다.

## 업데이트와 복구

소스를 변경하면 검증 후 Git 공통 디렉터리의 실행 사본도 갱신하고 두 파일의 SHA-256 일치를 확인합니다. 다른 작업 중인 사본을 임의로 덮어쓰지 않습니다.

최초 설치 전 로컬 설정은 Git 공통 디렉터리의 `haircrm-account/local-config.before.json`에, `enable-git` 직전 credential 설정은 `haircrm-account/credential-config.before.json`에 보관합니다. 두 파일은 로컬 복구용이며 공개 저장소에 추가하지 않습니다.

복구할 때는 이후 사용자 변경을 먼저 확인하고, 백업에 있는 해당 키만 원래 값으로 복원합니다. 현재 Git config 전체를 오래된 파일로 덮어쓰지 않습니다. 전용 프로필·Keychain 항목·원격 계정·브랜치·워크트리는 자동 삭제하지 않습니다.

## 검증

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_github_account.py' -v
git diff --check
```

회귀 검사는 임시 Git 저장소와 가짜 `gh`만 사용합니다. 잘못된 계정·권한 부족·환경변수 덮어쓰기·네트워크 오류·다른 저장소 요청·Git fallback 차단·로컬 helper 활성화를 확인하며 실제 토큰이나 GitHub 쓰기는 사용하지 않습니다. 합성 fixture는 임시 디렉터리에 남기고 기존 파일을 재귀 삭제하지 않습니다.

실제 완료 판정에는 전용 프로필 `check` 성공과 helper 활성화 뒤 기본 프로필·전역 Git 설정 불변 확인이 필요합니다. 공개 저장소의 `git ls-remote` 성공만으로 쓰기 인증을 검증했다고 판단하지 않습니다. 실제 push·PR·merge는 별도 승인된 게시 작업에서 수행합니다.
