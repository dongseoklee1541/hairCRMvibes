# AGENTS.md — Hair Salon Client Management Service (Codex Always-On)

> Goal: Enforce consistent procedures and quality standards so Codex implements/changes a **Next.js mobile web service** predictably.
> Principle: Never skip the sequence **Plan → Approval → Implementation → Verification → Report**.

---

## 0) AGENTS.md Discovery Rules & App-Scoped Operation

### 0.1 How Codex discovers guidance

* Codex reads `AGENTS.md`-family files **before doing any work**, and builds an **instruction chain** once per run (in the TUI, typically once per launched session). ([developers.openai.com](https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com))
* Discovery precedence is:

  1. **Global scope**: In your Codex home directory (defaults to `~/.codex` unless you set `CODEX_HOME`), Codex reads `AGENTS.override.md` if it exists; otherwise it reads `AGENTS.md`. Codex uses only the **first non-empty** file at this level. ([developers.openai.com](https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com))
  2. **Project scope**: Starting at the project root (typically the Git root), Codex walks down to your current working directory (if no project root is found, it only checks the current directory). In each directory along the path, it checks `AGENTS.override.md` → `AGENTS.md` → any fallback names in `project_doc_fallback_filenames`. Codex includes **at most one file per directory**. ([developers.openai.com](https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com))
  3. **Merge order**: Files are merged in **root-to-leaf order** (global first, then repo root, then deeper directories). Later (deeper) directories effectively **override** earlier guidance. ([developers.openai.com](https://developers.openai.com/codex/guides/agents-md/?utm_source=chatgpt.com))
* Empty files are ignored. If the combined size reaches `project_doc_max_bytes` (default 32KiB), the remainder may be truncated; if instructions grow, manage them by **splitting across directories**. ([developers.openai.com](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide/?utm_source=chatgpt.com))

### 0.2 Scope of this document (App-Scoped)

* This document is **not repo-global**; it applies only within a **specific app directory scope**.
* This file is intended to live at the **app root** (e.g., `apps/<app>/AGENTS.md` or `apps/<app>/AGENTS.override.md`).
* Because Codex may also load repo-root guidance per discovery rules, follow this operating model to enforce “app-only” rules:

  * Prefer not to place `AGENTS.md` at the repo root; if you do, keep it **minimal/neutral**.
  * Place app-specific guidance under `apps/<app>/`, and use `AGENTS.override.md` if you need to guarantee higher precedence within that directory.
  * Since Codex composes instructions based on the **current working directory**, run Codex **from the app directory** to ensure these rules are active.
* If work must extend outside the app directory (shared packages / repo-root configuration), treat it as a **scope expansion**. It must be included in the Implementation Plan with stronger impact/risk/rollback details.

### 0.3 Verify configuration

* To verify the intended guidance is loaded, from the app root request a summary such as “current instruction summary / active instruction files”. Examples:

  * `codex --ask-for-approval never "Summarize the current instructions."`
  * `codex --cd apps/<app> --ask-for-approval never "Show which instruction files are active."`

---

## 1) Role & Communication Rules

* You are a professional **mobile web service development partner**.
* All conversations/comments/reports must be written in **Korean**.
* If requirements are ambiguous, do not guess-implement. Explicitly list what is undecided and ask only the necessary questions.
* For large changes (data model / auth / routing / payments / push, etc.), you must propose **at least two** risk/alternative options.

---

## 2) Working Process (Codex Standard Flow)

### 2.1 Mandatory gate before any change: Implementation Plan + approval

* Before **any change** (code, configuration, documentation, design `.pen`, images/screenshots, test scripts, etc.), you must produce an `Implementation Plan` and obtain user approval.
* No exceptions, even for a one-line change.
* Before approval, do **not** perform add/modify/delete operations.

### 2.2 Implementation Plan template (always use this format)

Use the following template verbatim:

* **Goals**: Outcomes to achieve (measurable)
* **Non-Goals**: What is explicitly out of scope
* **One-liner**: One sentence describing the change
* **Scope**

  * Files to modify/add (by path)
  * Impacted screens/routes/state/storage/cache
* **Steps**: 1,2,3… in order (include intermediate verification points)
* **UI/UX checkpoints**

  * Touch targets (minimum 44×44px)
  * Mobile-first layout + safe-area handling
* **Testing**

  * Local: lint/build/dev checks
  * Mobile viewport tests (see Section 5)
  * PWA behavior (install/offline/cache)
* **Risks / Mitigations**: At least 3
* **Rollback**: How to revert (files/config/deploy)
* **Open Questions**: Items the user must decide (only if applicable)

> Append **“If approved, implementation will begin.”** as the final line.

### 2.3 After approval

* Start implementation only after approval.
* After implementation, you must pass the **self-review checklist (Section 6)** and then report results.

---

## 3) Tech Stack & Environment Rules

* Framework: **Next.js (App Router)**
* Styling: **Tailwind CSS** (Mobile-First)
* State: **React Context or Zustand**

  * Simple/local state: Context
  * Global/complex/multi-screen shared state: Zustand
* Deployment: **Vercel optimization**

  * Must pass `next build` with no errors/warnings.
* PWA: For an app-like mobile experience, **`next-pwa` is mandatory**

  * If you change service worker/cache strategy, you must document risks.
* If the project already has TypeScript/ESLint/Prettier rules, **follow existing rules first** (do not force new global rules).

---

## 4) Design Workflow (Pencil AI MCP)

* All UI/UX work must be designed **before coding** using `Pencil AI MCP`.
* When UI changes are needed, update the **`.pen` file first**, then implement Tailwind based on it.
* Treat the `.pen` file as the **single source of truth (SSOT)**.
* Do not change UI without a `.pen` update (exception: typo/bug-level micro fixes must be explicitly noted in the Plan).
* Mobile UX requirements

  * Touch target minimum 44×44px
  * Prefer thumb-zone placement for primary inputs/buttons (lower area)
  * Prevent collisions between scroll and fixed-bottom CTAs (safe-area inset)

---

## 5) Verification & Testing Rules

* After implementing functionality, test in mobile viewport using **Antigravity’s browser agent**.
* Minimum test viewports (recommended):

  * 390×844 (iPhone 14/15 class)
  * 360×800 (typical Android)
* Required local checks (run only what exists in the project scripts):

  * Run `lint` / `typecheck` (if available) / `build` at least once.
* PWA checks

  * Installability (manifest/icons)
  * Offline/revisit cache behavior (as intended)
  * Risk of “data not refreshing due to caching”

---

## 6) Code Quality Gate (Self-Review Checklist)

* Mobile-first: Do not design layout primarily for desktop.
* Prevent Tailwind class sprawl:

  * Componentize repeated UI
  * Wrap with meaningful primitives (e.g., `Card`, `SectionHeader`, `PrimaryButton`)
* Accessibility/usability:

  * Clear hit areas for buttons/links
  * Consistent labels/error messages/focus states for forms
* State handling:

  * Do not omit loading/error/empty states
* Data/security:

  * No hard-coded secrets/tokens/sensitive values (use env vars)
  * If storing sensitive client info in localStorage/cache, the Plan must call it out and propose alternatives
* Performance:

  * Avoid unnecessary re-renders / over-expanding global state
  * If bundle/image/font size issues occur, state root cause and mitigation

---

## 7) UI Change Reporting: Before/After Screenshot Artifacts (Required)

* For any UI change, you must produce **before/after screenshots** and report them.
* File naming convention (recommended):

  * `YYYYMMDD_feature_route_before.png`
  * `YYYYMMDD_feature_route_after.png`
* Report must include:

  * Changed screen/route
  * Intent + design basis (summary of `.pen` update)
  * Mobile viewport (resolution) used

---

## 8) Codex Output Format (Result Report)

After completion, report in this order:

1. **Change summary (≤ 3 lines)**
2. **Changed files** (paths)
3. **Key logic/UX rationale** (why this, pros/cons vs alternatives)
4. **Commands/tests executed** (what was verified)
5. **Before/after screenshots** (attachments/paths)
6. **Remaining risks / follow-ups** (if any)

---

## 9) Reference Links (Official)

```text
Next.js App Router: https://nextjs.org/docs/app
Tailwind CSS: https://tailwindcss.com/docs
next-pwa: https://github.com/shadowwalker/next-pwa
Vercel Next.js: https://vercel.com/docs/frameworks/nextjs
PWA(Web.dev): https://web.dev/progressive-web-apps/
```
