# Local Keychain Secret Operations

## 목적

`scripts/haircrm-keychain`은 hairCRMvibes 운영 검증에서 사용하는 로컬 비밀을 macOS login Keychain에 보관하고, 동일한 Apple 서명 접근자인 `/usr/bin/security`로만 읽도록 절차를 고정합니다.

이 도구의 목표는 여러 임시 Swift 실행 파일이 서로 다른 접근자로 인식되어 Keychain 암호 확인이 반복되는 문제를 줄이는 것입니다. 기존 항목은 최초 전환 시 항목별로 한 번 `항상 허용`이 필요할 수 있지만, 이후 같은 항목을 같은 도구로 읽을 때는 다시 묻지 않는 것이 정상입니다.

## 보안 경계

- 실제 비밀값은 Git, 문서, shell 인자, stdout/stderr에 출력하지 않습니다.
- `security -A`, 임의 service/account, raw `get`, 범용 `exec`는 제공하지 않습니다.
- 비밀은 항목별로 분리합니다. DB password와 CRON secret을 하나의 JSON 항목으로 합치지 않습니다.
- 이 wrapper의 alias allowlist는 service/account 입력을 고정하지만 기존 Keychain ACL 전체를 정규화하거나 기존 trusted app을 자동 제거하지는 않습니다.
- 이 wrapper는 운영 실수를 줄이는 allowlist이지, 로그인한 동일 사용자의 악성 프로세스나 root를 차단하는 보안 경계는 아닙니다.
- `psql` 실행 중 DB password는 자식 프로세스 환경에만 존재합니다. 같은 사용자나 root가 프로세스를 완전히 장악한 상황은 방어하지 못합니다.
- `SUPABASE_SECRET_KEY`의 발급·회전·폐기 원본은 Supabase이며, Vercel Production 환경변수에는 배포용 사본만 둡니다. `CRON_SECRET`의 운영 사본은 Vercel Production 환경변수에 두고, 로컬 Keychain 사본은 승인된 점검에서만 사용합니다.

유효한 macOS code-signing identity가 준비되면 `/usr/bin/security`보다 접근 범위를 좁힌 전용 native helper를 별도 Plan으로 검토합니다. 현재 ad-hoc helper는 재빌드 시 identity가 달라질 수 있어 사용하지 않습니다.

## 고정 alias

| Alias | Keychain service | Account | 용도 |
| --- | --- | --- | --- |
| `prod-db` | `hairCRMvibes-supabase-db` | `idongseog` | Production DB password |
| `vercel-cron` | `hairCRMvibes-vercel-cron-secret` | `production` | Vercel Cron Bearer secret |
| `r07-temp:<run-id>:<slot>` | `hairCRMvibes-r07-prod-smoke` | `<run-id>:<slot>` | 실행별 임시 synthetic 검증값 |

`run-id`는 `r07prod-YYYYMMDDThhmmssZ-abcdef` 형식만 허용합니다. 임시 slot은 다음 값만 허용합니다.

```text
owner-email
owner-password
staff-email
staff-password
supabase-secret-key
```

## 기본 사용법

스크립트는 저장소 root에서 실행합니다.

```bash
scripts/haircrm-keychain status prod-db
scripts/haircrm-keychain status vercel-cron
scripts/haircrm-keychain probe prod-db --repeat 10
scripts/haircrm-keychain probe vercel-cron --repeat 10
```

`probe`는 값을 출력하지 않고 내부 메모리에서 비어 있지 않은 동일 값인지 확인합니다. 기존 항목을 처음 `probe`할 때 Keychain 대화상자가 나오면 정확한 항목과 접근자 `/usr/bin/security`를 확인한 후 `항상 허용`을 선택합니다.

같은 alias에서 계속 대화상자가 나오면 다음을 확인합니다.

1. 임시 Swift 또는 다른 실행 파일이 항목을 읽고 있지 않은지 확인합니다.
2. Keychain 항목이 매번 삭제·재생성되고 있지 않은지 확인합니다.
3. macOS login Keychain이 잠겼거나 접근 제어가 변경되지 않았는지 확인합니다.

## 신규 저장과 회전 경계

신규 항목은 값을 명령 인자에 넣지 않고 `/usr/bin/security`의 터미널 hidden prompt 지시에 따라 입력합니다. 이는 신규 등록 시에만 필요한 입력이며, 이후 조회 때 반복되는 login password 확인과는 별개입니다.

```bash
scripts/haircrm-keychain store prod-db
scripts/haircrm-keychain store vercel-cron
```

이미 존재하는 항목은 실수로 덮어쓰지 않으며 wrapper에서 `replace`를 제공하지 않습니다. 회전은 원격 원본 회전, 새 값 검증, 로컬 Keychain 갱신, 재검증 순서가 필요한 별도 승인 작업으로 수행합니다.

`-w <값>`, `-p <값>`, `-X <hex>` 방식은 process argument에 실제 비밀을 남길 수 있으므로 사용하지 않습니다. 실제 비밀 등록은 자동화 파이프가 아니라 터미널 prompt로 수행합니다.

신규 저장은 `/usr/bin/security`를 trusted app으로 지정하고 저장 직후 비어 있지 않은 허용 형식인지 다시 읽어 확인합니다. 각 시도에는 비민감 고유 comment marker를 넣으며, 검증에 실패하면 service/account/marker가 모두 일치하는 방금 만든 신규 항목만 삭제하고 marker 부재를 다시 확인합니다.

이 prompt 경로는 1~127자의 줄바꿈 없는 짧은 token/password만 지원합니다. 긴 JSON manifest는 잘릴 수 있으므로 이 wrapper에 저장하지 않고, 해당 검증 프로세스 메모리에서 유지하거나 별도 승인된 저장 방식을 사용합니다.

## Production DB probe

DB password를 출력하지 않고 고정 Production pooler에 `verify-full`, Supabase root CA, SCRAM 인증을 강제한 `select 1`만 실행합니다. 사용자 host, URI, SQL, psql meta-command는 받지 않습니다.

```bash
scripts/haircrm-keychain db-probe
```

명령은 `psqlrc`, password prompt, inherited `PG*` routing 변수를 차단하고 결과가 정확히 `1`인지 내부 확인합니다. DB endpoint가 변경되면 저장소의 Supabase linked metadata를 재확인한 뒤 별도 코드 변경으로 고정값을 갱신합니다.

공개 `Supabase Root 2021 CA`는 로그인된 Dashboard의 `Download certificate` 링크에서 확인했으며, script에 고정된 SHA-256 지문은 `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`입니다. 실행 시 0600 임시 파일로 만들고 지문을 다시 검증한 뒤 `psql` 종료 즉시 삭제합니다. 인증서가 회전되면 [Supabase PSQL SSL 안내](https://supabase.com/docs/guides/database/psql)에 따라 다시 검증해 갱신합니다.

## Cron 요청

`CRON_SECRET`을 출력하거나 HTTP header 인자에 넣지 않고, 승인된 Vercel host와 정확한 route에만 전달합니다.

```bash
scripts/haircrm-keychain cron-request \
  'https://hair-cr-mvibes.vercel.app/api/cron/supabase-keepalive'
```

허용 URL은 canonical `https://hair-cr-mvibes.vercel.app/api/cron/supabase-keepalive` 하나뿐이며 query, fragment, userinfo, 다른 host/path는 거부합니다. proxy와 TLS key logging 환경변수를 제거하고 `curl -v`, trace, redirect, 사용자 지정 header 옵션은 제공하지 않습니다.
응답 본문은 출력하지 않고 HTTP `200`, `application/json` content type, 정확한 `{"ok":true}` payload를 모두 만족할 때만 성공으로 처리합니다. 본문은 1KiB로 제한한 0600 임시 파일에서 메모리로 읽어 검증한 뒤 즉시 삭제합니다. canonical 배포에 route가 아직 반영되지 않았다면 `404`는 정상적인 미승격 상태이므로 Production 승격 후 다시 검증합니다.

## 임시 R-07 항목

실행별 synthetic 검증값은 고정 service 아래 run-scoped account로만 저장합니다.

```bash
alias_name='r07-temp:r07prod-20260712T000000Z-abcdef:owner-password'
scripts/haircrm-keychain store "$alias_name"
scripts/haircrm-keychain probe "$alias_name" --repeat 10
scripts/haircrm-keychain delete "$alias_name" --confirm "$alias_name"
```

임시 항목은 해당 검증이 끝나고 원격 세션·fixture 정리를 확인한 뒤 정확한 alias로 삭제합니다. `delete`는 wildcard나 service 전체 삭제를 지원하지 않습니다.

## Self-test

```bash
scripts/haircrm-keychain self-test
```

Self-test는 운영 비밀 대신 코드에 공개된 비민감 canary 한 개를 생성해 다음을 검증합니다. 이 검사는 실제 비밀의 prompt 입력 경로가 아니라 고정 접근자의 반복 읽기와 cleanup만 검증합니다.

1. `/usr/bin/security`를 접근자로 지정한 저장
2. 비밀 비출력 상태에서 동일 값 10회 연속 읽기
3. 정확한 canary 항목 삭제
4. 잔존 항목 0개

EXIT, INT, TERM, HUP 시에도 생성된 정확한 canary만 정리합니다.

## 복구 및 rollback

- wrapper 파일을 되돌려도 기존 Keychain 항목과 Vercel 환경변수는 유지됩니다.
- 항목 삭제는 `delete <alias> --confirm <same-alias>`처럼 정확한 확인을 요구합니다.
- 비밀 노출이 의심되면 wrapper 복구보다 해당 Supabase/Vercel 비밀의 원격 회전을 우선합니다.
- `.env.local` 이전이나 권한 보정은 이 도구의 범위가 아니며 별도 보안 Plan으로 수행합니다.
