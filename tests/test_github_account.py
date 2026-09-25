"""실제 GitHub·자격증명을 사용하지 않는 계정 선택 회귀 검사."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/gh-account"
FAKE_GH = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
with Path(os.environ["HAIRCRM_TEST_CALLS"]).open("a") as f:
    f.write(json.dumps({"args": args, "profile": os.environ.get("GH_CONFIG_DIR"),
                       "repo": os.environ.get("GH_REPO"), "debug": os.environ.get("GH_DEBUG")}) + "\n")
case = os.environ.get("HAIRCRM_TEST_CASE", "ok")
if args[:2] == ["api", "user"]:
    if case == "network":
        print("error connecting to api.github.com", file=sys.stderr); sys.exit(1)
    if case == "expired":
        print("HTTP 401: Bad credentials", file=sys.stderr); sys.exit(1)
    print("wrong-user" if case == "wrong" else "fixture-account")
elif args[:1] == ["api"]:
    if case == "denied":
        print("HTTP 403", file=sys.stderr); sys.exit(1)
    print("false" if case == "readonly" else "true")
elif args == ["auth", "git-credential", "get"]:
    sys.stdin.read()
    print("username=fixture-account\npassword=synthetic-test-only\n")
else:
    print("PR_COMMAND_EXECUTED")
'''


class GithubAccountTest(unittest.TestCase):
    def setUp(self):
        # 생성한 합성 fixture는 /tmp에만 두며 재귀 삭제를 수행하지 않습니다.
        self.base = Path(tempfile.mkdtemp(prefix="haircrm-gh-test-"))
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.profile = self.base / "profile"
        self.profile.mkdir()
        (self.profile / "hosts.yml").write_text("# synthetic fixture, no credentials\n")
        binary = self.base / "bin"
        binary.mkdir()
        fake = binary / "gh"
        fake.write_text(FAKE_GH)
        fake.chmod(0o700)
        self.calls = self.base / "calls.jsonl"
        self.env = os.environ.copy()
        for key in ("GH_TOKEN", "GITHUB_TOKEN", "GIT_DIR", "GIT_WORK_TREE", "GIT_CONFIG_PARAMETERS"):
            self.env.pop(key, None)
        self.env.update(PATH=str(binary) + os.pathsep + os.environ["PATH"],
                        GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1",
                        GIT_TERMINAL_PROMPT="0", HAIRCRM_TEST_CALLS=str(self.calls))
        self.git("init", "-q", "--template=")
        self.git("remote", "add", "origin", "https://github.com/fixture/repository.git")
        self.git("config", "--local", "haircrm.githubAccount", "fixture-account")
        self.git("config", "--local", "haircrm.githubRepository", "fixture/repository")
        self.git("config", "--local", "haircrm.ghConfigDir", str(self.profile))

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, env=self.env,
                              capture_output=True, text=True, check=True)

    def run_tool(self, *args, payload=None, case="ok", cwd=None):
        env = {**self.env, "HAIRCRM_TEST_CASE": case}
        return subprocess.run([str(SCRIPT), *args], cwd=cwd or self.repo, env=env,
                              input=payload, capture_output=True, text=True)

    def recorded(self):
        return [json.loads(line) for line in self.calls.read_text().splitlines()] if self.calls.exists() else []

    def test_check_uses_profile_and_actual_api_identity(self):
        result = self.run_tool("check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["account"], "fixture-account")
        self.assertTrue(all(call["profile"] == str(self.profile) for call in self.recorded()))

    def test_pr_is_pinned_to_repository(self):
        result = self.run_tool("pr", "list")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.recorded()[-1]["args"], ["pr", "list", "--repo", "fixture/repository"])

    def test_wrong_account_never_runs_pr(self):
        result = self.run_tool("pr", "create", case="wrong")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(self.recorded()), 1)
        self.assertNotIn("PR_COMMAND_EXECUTED", result.stdout)

    def test_readonly_account_never_runs_pr(self):
        result = self.run_tool("pr", "merge", case="readonly")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("쓰기 권한", result.stderr)
        self.assertEqual(len(self.recorded()), 2)

    def test_network_failure_is_not_reported_as_expiry(self):
        result = self.run_tool("check", case="network")
        self.assertIn("DNS·네트워크·sandbox", result.stderr)
        self.assertNotIn("재인증하세요", result.stderr)

    def test_authentication_failure_is_distinct(self):
        result = self.run_tool("check", case="expired")
        self.assertIn("재인증", result.stderr)

    def test_permission_failure_is_distinct(self):
        result = self.run_tool("check", case="denied")
        self.assertIn("권한·SSO", result.stderr)

    def test_missing_profile_requests_user_login(self):
        self.git("config", "--local", "haircrm.ghConfigDir", str(self.base / "missing"))
        result = self.run_tool("check")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("최초 로그인", result.stderr)
        self.assertEqual(self.recorded(), [])

    def test_inherited_token_cannot_override_profile(self):
        self.env["GH_TOKEN"] = "synthetic-test-only"
        result = self.run_tool("pr", "create")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.recorded(), [])

    def test_debug_logging_is_disabled(self):
        self.env["GH_DEBUG"] = "api"
        result = self.run_tool("check")
        self.assertEqual(result.returncode, 0)
        self.assertTrue(all(call["debug"] is None for call in self.recorded()))

    def test_repository_and_browser_overrides_are_rejected(self):
        for args in (("--repo", "other/repo"), ("-Rother/repo",), ("--web",),
                     ("https://github.com/other/repo/pull/1",),
                     ("http://github.com/other/repo/pull/1",),
                     ("https://github.example.com/fixture/repository/pull/1",)):
            with self.subTest(args=args):
                result = self.run_tool("pr", "view", *args)
                self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.recorded(), [])

    def test_changed_origin_is_rejected(self):
        self.git("remote", "set-url", "origin", "https://github.com/other/repo.git")
        self.assertNotEqual(self.run_tool("check").returncode, 0)
        self.assertEqual(self.recorded(), [])

    def test_credentials_only_go_to_matching_repository(self):
        request = "protocol=https\nhost=github.com\npath=fixture/repository.git\n\n"
        result = self.run_tool("credential-helper", "get", payload=request)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("password=synthetic-test-only", result.stdout)
        self.assertEqual(self.recorded()[-1]["args"], ["auth", "git-credential", "get"])

    def test_foreign_credential_request_quits_without_lookup(self):
        result = self.run_tool("credential-helper", "get",
                               payload="protocol=https\nhost=github.com\npath=other/repo.git\n\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "quit=true\n\n")
        self.assertEqual(self.recorded(), [])

    def test_git_does_not_fall_back_after_account_mismatch(self):
        self.git("config", "credential.helper", "")
        self.git("config", "--add", "credential.helper", f"!{SCRIPT} credential-helper")
        self.git("config", "--add", "credential.helper", "!echo FALLBACK_CALLED >&2")
        self.git("config", "credential.useHttpPath", "true")
        result = subprocess.run(["git", "credential", "fill"], cwd=self.repo,
                                env={**self.env, "HAIRCRM_TEST_CASE": "wrong"},
                                input="protocol=https\nhost=github.com\npath=fixture/repository.git\n\n",
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("FALLBACK_CALLED", result.stderr)
        self.assertNotIn("password=", result.stdout)

    def test_store_and_erase_never_change_authentication(self):
        for operation in ("store", "erase"):
            self.assertEqual(self.run_tool("credential-helper", operation).returncode, 0)
        self.assertEqual(self.recorded(), [])

    def test_config_in_git_common_directory_works_from_subdirectory(self):
        subdir = self.repo / "nested"
        subdir.mkdir()
        self.assertEqual(self.run_tool("check", cwd=subdir).returncode, 0)

    def test_profile_inside_repository_is_rejected(self):
        self.git("config", "haircrm.ghConfigDir", str(self.repo / "profile"))
        self.assertNotEqual(self.run_tool("check").returncode, 0)
        self.assertEqual(self.recorded(), [])

    def test_enable_git_checks_identity_before_config_changes(self):
        before = (self.repo / ".git/config").read_bytes()
        result = self.run_tool("enable-git", case="wrong")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.repo / ".git/config").read_bytes(), before)

    def test_installed_helper_enables_git_without_global_changes(self):
        import shlex

        installed = self.repo / ".git/haircrm-account/gh-account"
        installed.parent.mkdir()
        installed.write_bytes(SCRIPT.read_bytes())
        installed.chmod(0o700)
        self.git("config", "credential.https://github.com.helper", "old-helper")
        self.git("config", "alias.gh-account", "!" + shlex.quote(str(installed)))
        result = self.git("gh-account", "enable-git")
        self.assertIn("전용 계정", result.stdout)
        helpers = self.git("config", "--get-all", "credential.https://github.com.helper").stdout.splitlines()
        self.assertEqual(helpers, ["", "!" + shlex.quote(str(installed.resolve())) + " credential-helper"])
        self.assertEqual(self.git("config", "--get", "credential.https://github.com.useHttpPath").stdout.strip(), "true")
        backup = installed.parent / "credential-config.before.json"
        self.assertEqual(json.loads(backup.read_text())["credential.https://github.com.helper"], ["old-helper"])
        original_backup = backup.read_bytes()
        self.git("gh-account", "enable-git")
        self.assertEqual(backup.read_bytes(), original_backup)


if __name__ == "__main__":
    unittest.main()
