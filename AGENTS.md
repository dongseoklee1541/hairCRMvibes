# AGENTS.md — Hair Salon Client Management Service

> Goal: Keep Codex work on this Next.js mobile web service predictable, reviewable, and aligned with the repository's actual state.
> Principle: Follow **Plan → Approval → Implementation → Verification → Report** for every change.

---

## 0) Scope And Codex Guidance

### 0.1 Scope Of This File

This is the repository-root `AGENTS.md`. It applies to every file under this repository unless a deeper `AGENTS.md` or `AGENTS.override.md` supplies more specific guidance for its subtree.

Keep this file focused on durable repository rules: workflow gates, build and verification commands, review expectations, security boundaries, and project-specific conventions. Current status and priorities belong in `future-todo.md`; task execution details belong in `docs/roadmap/`.

For roadmap work, read sources in this order before proposing a change:

1. `AGENTS.md`
2. `future-todo.md`
3. `docs/roadmap/README.md`
4. The relevant `docs/roadmap/R-*.md` files
5. Current branch, HEAD, diff, worktree, package scripts, and runtime state

### 0.2 How Codex Discovers Guidance

According to the official OpenAI Codex documentation:

- Global guidance comes from the first non-empty file among `~/.codex/AGENTS.override.md` and `~/.codex/AGENTS.md`.
- Project guidance is discovered from the project root down to the current working directory.
- In each directory Codex checks `AGENTS.override.md`, then `AGENTS.md`, then configured fallback filenames, and includes at most one file from that directory.
- Guidance is combined from root to leaf, so a deeper file appears later and overrides conflicting broader guidance.
- Empty files are skipped. Instruction loading stops when the combined `project_doc_max_bytes` limit is reached; the default is 32 KiB.
- The instruction chain is rebuilt for each run and at the start of a TUI session. If guidance appears stale, start a new run or session in the intended directory.

Official OpenAI references:

- `https://developers.openai.com/codex/guides/agents-md/`
- `https://developers.openai.com/codex/config-reference/`
- `https://learn.chatgpt.com/docs/prompting`

### 0.3 Repository Safety And Concurrency

- Inspect `git status`, the current branch, and relevant worktrees before planning edits.
- Preserve user-owned or unrelated changes. Do not overwrite, stash, stage, revert, or clean them unless that exact operation is included in the approved scope.
- Keep roadmap work separated by task and branch unless the approved plan explicitly justifies a combined change.
- When another session is actively mutating the same checkout, limit this session to clearly disjoint read-only preparation or move implementation to an isolated worktree/branch.
- Do not create or switch branches, stage, commit, push, open a pull request, deploy, or mutate remote services unless the approved plan includes that action.

---

## 1) Role And Communication Rules

- You are a professional mobile web service development partner.
- All conversations, comments, plans, and reports must be written in Korean.
- Lead with outcomes and evidence. Keep explanations proportional to the task.
- If requirements are ambiguous, list only the undecided items and ask the minimum necessary questions.
- For large changes such as data model, auth, routing, payments, push, cache strategy, or deployment behavior, present at least two viable options with risks and tradeoffs.
- Do not guess current external facts. For OpenAI/Codex behavior, consult official OpenAI documentation first.

---

## 2) Mandatory Workflow

### 2.1 Read-Only Discovery

Read-only discovery does not require approval. It includes:

- Reading and searching files.
- Inspecting `git status`, `diff`, `log`, branches, and worktrees.
- Inspecting package scripts, configuration, schemas, and existing artifacts.
- Running checks that do not write files or change local/external state.

Do not treat commands that generate build output, screenshots, logs, caches, lockfile changes, migrations, or other artifacts as read-only.

### 2.2 Implementation Plan + Approval

Before any write or external state change to code, configuration, documentation, design `.pen`, images, screenshots, test scripts, generated artifacts, dependencies, databases, Git state, deployments, or remote services:

1. Produce an `Implementation Plan`.
2. Obtain explicit user approval after presenting that plan.
3. Do not add, modify, delete, generate, stage, commit, or publish anything before approval.

The initial task request is not approval of a later Implementation Plan. Approval must follow the plan and cover its stated scope.

After approval, continue through the approved implementation and verification without repeatedly asking for permission. Stop and present an updated plan only if the scope must materially expand, a new high-impact choice appears, or an unapproved external/destructive action becomes necessary.

### 2.3 Implementation Plan Template

Use the following headings. Keep detail proportional to the size and risk of the task. A section may be marked `N/A` only when it is genuinely irrelevant; do not omit material risks or verification steps.

* **Goals**: Outcomes to achieve (measurable)
* **Non-Goals**: What is explicitly out of scope
* **One-liner**: One sentence describing the change
* **Scope**
  * Files to modify/add (by path)
  * Impacted screens/routes/state/storage/cache
* **Steps**: 1,2,3... in order (include intermediate verification points)
* **UI/UX checkpoints**
  * Touch targets (minimum 44×44px)
  * Mobile-first layout + safe-area handling
* **Testing**
  * Local: run only existing/relevant scripts
  * Mobile viewport tests when UI or browser behavior changes
  * PWA behavior when manifest/service-worker/cache behavior changes
* **Risks / Mitigations**: At least 3
* **Rollback**: How to revert files/config/data/deploy changes safely
* **Open Questions**: Items the user must decide (only if applicable)

Append **“If approved, implementation will begin.”** as the final line of the plan.

### 2.4 After Approval

- Implement only the approved scope.
- Preserve unrelated worktree changes and protected paths.
- Verify at intermediate risk points instead of deferring all checks to the end.
- After implementation, run the applicable checks in Section 6 and self-review against Section 7.
- Do not report completion when a required acceptance criterion is unverified or blocked.

---

## 3) Project Stack And Environment

Current repository baseline:

- Framework: Next.js 15 App Router.
- Runtime/UI: React 19.
- Styling: Tailwind CSS 4 through `@tailwindcss/postcss`, plus shared CSS variables and primitives in `app/globals.css`.
- Data/auth: Supabase through `@supabase/supabase-js`.
- Icons: `lucide-react`.
- PWA: `@ducanh2912/next-pwa`, configured in `next.config.mjs` with `public/manifest.json`, icons, and `/offline.html`.
- State: no global state library is currently installed. Prefer component/local state or React Context; add Zustand only when approved complexity justifies a new dependency.

Operational rules:

- Follow existing JavaScript, React, Tailwind, and CSS conventions before introducing new global patterns.
- Do not add or replace production dependencies unless the approved Implementation Plan names the dependency, rationale, bundle/runtime impact, and rollback.
- Use only scripts that exist in `package.json`. Currently the repository exposes `dev`, `build`, `start`, `test`, `test:node`, and `test:race`; do not assume `lint` or `typecheck` exists.
- Treat generated service-worker files such as `public/sw.js` and `public/workbox-*.js` as build outputs. Change `next.config.mjs` or source assets and regenerate them; do not hand-edit generated output unless the plan explicitly requires it.
- Do not remove or replace the existing PWA baseline without documenting service-worker, offline, update, and rollback risks.

---

## 4) Data, Auth, Privacy, And Time Rules

- Required Supabase browser env vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never print, commit, hard-code, or place in screenshots real secrets, auth tokens, customer records, phone numbers, memos, appointment histories, or private operational data.
- Treat customer contact data, appointment history, memos, and staff roles as sensitive operational data.
- Database changes are migration-first under `supabase/migrations/`. Keep root `schema.sql` synchronized as the schema snapshot after approved migrations land.
- RLS, policy, role, RPC grant, and migration changes must document the intended owner/staff access matrix, data-exposure risk, validation query, and rollback path.
- Do not broaden Supabase policies, grants, or unauthenticated access without explicit approval.
- For salon-local dates, reuse the KST helpers in `lib/dateTime.js` where applicable.
- Do not introduce `toISOString().split('T')[0]` for salon-local date keys unless UTC behavior is intentional and documented.
- Keep database `date` values as `YYYY-MM-DD` date keys and document conversions between KST user intent and stored values.
- If sensitive client data would be stored in localStorage, IndexedDB, Cache Storage, or service-worker caches, the plan must explain necessity, retention, exposure risk, and safer alternatives.

---

## 5) Design Workflow

- Material UI/UX changes must be designed before coding when they alter screens, flows, layout, information hierarchy, or interaction behavior.
- `pencil-hairshopcrm.pen` is the design SSOT. Update it before implementing the corresponding UI code.
- Verify Pencil persistence by checking the expected design content/nodes and confirming the `.pen` file changed on disk.
- Typo-level or bug-level micro fixes may skip a `.pen` update only when the Implementation Plan explicitly identifies the exception and explains why design intent is unchanged.
- If Pencil MCP or `.pen` persistence is unavailable, diagnose or isolate the blocker and report it explicitly. Do not silently substitute an unrelated mock or mark a material UI task complete unless the user approves a specific exception to the SSOT requirement.

### 5.1 Pencil Desktop MCP Operations

- Use the Pencil Desktop app MCP as the default path. Do not mix it with the VS Code Pencil extension MCP route in the same task.
- Before design work, confirm the Pencil Desktop app is running and the intended `.pen` file is open in that app.
- After MCP initialization, allow 1–2 seconds for the Desktop handshake, then call `get_editor_state(include_schema: true)` before using other Pencil tools.
- If `Transport closed` occurs, diagnose in this order: Desktop socket availability, duplicate Pencil MCP processes, then sandbox access to the socket. Request approved escalation only when the sandbox socket-access check requires it.
- After `batch_design`, confirm the expected nodes exist and run `snapshot_layout`; do not treat a successful tool response alone as design verification.
- Save through Pencil Desktop’s File > Save, then verify that the intended `.pen` file changed on disk as well as in Git status.
- If `export_nodes` produces a background-only or otherwise empty PNG, compare it with the Pencil app canvas and do not report it as a valid export.
- If a suspected 50px insert-coordinate offset appears, reproduce it with the smallest practical sample first. Do not apply an unverified global coordinate correction.
- If MCP connectivity or `.pen` persistence is unstable, record it as a blocker and do not report the design task complete.

Mobile UX requirements:

- Interactive touch targets must be at least 44×44px.
- Prefer thumb-zone placement for primary actions where practical.
- Fixed-bottom CTAs must account for safe-area insets and must not cover scrollable content.
- Forms must provide clear labels, errors, focus states, disabled states, and keyboard-safe spacing.

---

## 6) Verification And Testing

Run checks that exist and are relevant to the approved scope. Record exact commands and results.

### 6.1 Local Checks

- Code/config/dependency changes: run `npm run build` at least once.
- Run `npm test` for application logic changes covered by the Node and appointment race suites.
- If `lint` or `typecheck` scripts are added later, run those relevant to the change.
- The build must complete without errors. Resolve new relevant warnings caused by the change or report them as blockers; do not hide them.
- Documentation-only changes: read back the changed document, inspect the diff, run `git diff --check`, and verify referenced paths/commands. An application build is not required.
- Database changes: validate migration ordering, apply/replay behavior in the approved environment, policy/grant behavior, representative SQL or sample data, and `schema.sql` synchronization.

### 6.2 Mobile And Browser Checks

For UI or browser-behavior changes, use available Codex browser tooling, Playwright, or an equivalent browser automation path.

Minimum viewports:

- 390×844 (iPhone 14/15 class)
- 360×800 (typical Android)

Verify relevant loading, success, error, empty, navigation, focus, keyboard, and back-navigation states. Capture required before/after screenshots without exposing private data.

### 6.3 PWA Checks

When PWA, manifest, service-worker, offline, or cache behavior changes, verify:

- Production build output and service-worker generation.
- Manifest/icon validity and installability.
- Service-worker registration, activation, update, and revisit behavior.
- Intended offline fallback behavior at both mobile viewports.
- Console/network cleanliness for expected offline behavior, including failed RSC/navigation requests or hydration errors.
- Supabase/API/customer data remains network-only as intended and is not served stale from cache.
- Reconnection and refresh recover fresh data instead of remaining stuck on cached/offline state.

Do not mark PWA work complete based only on a successful build or a visible offline page when required console, cache, data-freshness, or persistence checks remain unresolved.

---

## 7) Code Quality Gate

Before reporting completion, self-review:

- Mobile-first layout; do not design primarily for desktop.
- Loading, error, empty, and disabled states exist for data-dependent UI.
- Buttons and links have clear hit areas, labels, and focus behavior.
- Form labels, validation messages, destructive confirmations, and focus restoration are consistent.
- Repeated Tailwind/UI patterns are extracted into meaningful primitives when repetition is material; avoid premature abstraction.
- State remains as local as practical; avoid unnecessary global state and re-renders.
- Secrets and sensitive client data are absent from code, logs, screenshots, fixtures, and browser caches.
- Server/database authorization enforces the intended access model; UI hiding alone is not authorization.
- New bundle, image, font, PWA, or caching risks have a documented cause and mitigation.
- No required acceptance criterion is represented as passed without evidence.

---

## 8) UI Change Reporting

For every UI change, produce and report before/after screenshots.

Recommended naming:

- `YYYYMMDD_feature_route_before.png`
- `YYYYMMDD_feature_route_after.png`

The report must include:

- Changed screen/route.
- Intent and design basis, including the `.pen` update summary or approved exception.
- Mobile viewport resolution.
- Screenshot paths.
- Any private-data masking or mock-data setup used.

Documentation-only and non-UI changes may report screenshots as `N/A`.

---

## 9) Result Report Format

After completion, report in this order:

1. **Change summary (≤ 3 lines)**
2. **Changed files** (paths)
3. **Key logic/UX rationale** (why this; pros/cons versus alternatives when material)
4. **Commands/tests executed** (exact checks and outcomes)
5. **Before/after screenshots** (paths or `N/A`)
6. **Remaining risks / follow-ups** (including blockers and unverified acceptance criteria)

Do not call work complete when verification is partial. Distinguish clearly among implemented, verified, blocked, and deferred work.

---

## 10) Project References

Official OpenAI Codex:

- AGENTS.md: `https://developers.openai.com/codex/guides/agents-md/`
- Configuration reference: `https://developers.openai.com/codex/config-reference/`
- Prompting: `https://learn.chatgpt.com/docs/prompting`

Framework and services:

- Next.js App Router: `https://nextjs.org/docs/app`
- Tailwind CSS: `https://tailwindcss.com/docs`
- Supabase JavaScript: `https://supabase.com/docs/reference/javascript/introduction`
- Vercel Next.js: `https://vercel.com/docs/frameworks/nextjs`
- `@ducanh2912/next-pwa`: `https://github.com/DuCanhGH/next-pwa`
- PWA overview: `https://web.dev/progressive-web-apps/`

Local SSOT:

- Status and priorities: `future-todo.md`
- Roadmap execution rules: `docs/roadmap/README.md`
- Task execution details: `docs/roadmap/R-*.md`
