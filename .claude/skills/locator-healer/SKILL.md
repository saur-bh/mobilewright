---
name: locator-healer
description: Use this whenever a test in this Mobilewright Android repo (btx-mw-prod) is failing, flaky, or timing out — "this test is failing", "element not found", "locator not visible", "the test is flaky", "fix this broken test", "heal this test", "uiautomator dump error", "the app changed and now the test breaks". Also trigger proactively after any app/APK update when existing tests start failing, even if the user just pastes a stack trace or error log without asking for a specific fix. This diagnoses whether the real cause is a stale locator, a driver/dump failure, or genuine timing flakiness, and fixes it at the right layer instead of papering over it with a longer timeout.
---

# Diagnosing and healing a broken/flaky test

A failing test in this repo almost always falls into one of three buckets, and each one has a
different correct fix. Guessing the wrong bucket is how you end up bumping a timeout that hides a
real UI regression, or rewriting a locator that was never the problem. Triage first.

## Step 0: read the actual failure artifacts

Don't start from the error message alone. `test-results/` (gitignored, named after the
`describe`/`test` titles) holds, per failing test:

- a **screenshot** at the moment of failure — what screen was actually on-device
- a **video** (the suite runs with `video: 'retain-on-failure'`)
- a **view-tree JSON** (`viewTree: 'on-failure'` in `mobilewright.config.js`) — the accessibility
  tree Mobilewright saw, which tells you exactly what locators/testIds/roles existed at that
  moment without needing a live device

Read the view-tree JSON and screenshot for the failing test before touching any code. This alone
usually answers "is the element actually gone, or did the test just not wait long enough."

## Step 1: classify the failure

**A. Locator is genuinely gone or changed** — the view-tree JSON/screenshot shows the screen
rendered, but no element matches the old `getByTestId`/`getByRole`/`getByLabel` selector (the app's
UI changed: a testId was renamed, copy changed, role changed). This is a real break, not flakiness.
→ go to Step 2.

**B. Driver/dump failure** — the error is about the `uiautomator` dump itself failing or hanging
(not "element not found," but the dump/query mechanism erroring out), or every locator call on the
screen fails identically regardless of what it's looking for. Two common causes:
- `patchDumpRetry(screen)` wasn't called for this test/fixture — check the test calls it as its
  first line (see `utils/dump-retry.js` and any test in `tests/postLogin.spec.js` for the
  pattern). The framework's own locator polling retries a "not found yet" state but **not** a raw
  dump failure — only this patch does that.
- An orphaned instrumentation process is holding the device's exclusive UiAutomation connection
  from a previous killed dump attempt. Check for it directly:
  ```bash
  adb shell ps -A | grep app_process
  ```
  Kill any stale one and retry. This is a device-state problem, not a code problem — fixing it in
  the test file won't help.

**C. Genuine timing flakiness** — the element shows up in the view-tree JSON / is visible on the
retry screenshot, so it does eventually appear, but the assertion's timeout fired before it did.
→ go to Step 3. Do not confuse this with bucket A — if the element truly never appears in any
artifact, it's not a timing issue, it's a missing/changed locator.

## Step 2: fix a stale/changed locator

1. Find which page object under `pages/` owns the broken getter (grep the testId/text/label used
   in the failing assertion).
2. Get the current, correct locator from the live app rather than guessing from the view-tree JSON
   snippet alone — drive the device to the same screen and inspect it:
   ```bash
   npx mobilewright inspect
   ```
3. Update only the selector inside the getter (the `getByTestId`/`getByRole`/`getByLabel` call) —
   keep the getter's **name** and **contract** (what it returns, sync vs locator) unchanged, so you
   don't have to touch every page object/spec that already calls it.
4. If the element moved to a different screen/page-object entirely (not just renamed in place),
   move the getter to the right page object rather than leaving it stranded on the wrong one.
5. Re-run the specific test (`npx mobilewright test --grep "<name>"`) and also grep the codebase
   for other callers of that getter — a renamed element often breaks more than one flow
   (`ensureSignedIn()` in `pages/auth-flow.js` is a common shared path worth checking).

## Step 3: fix genuine timing flakiness

- `actionTimeout` is deliberately `5_000` globally (see `mobilewright.config.js` — called out as
  "your main bottleneck"), so most locators should resolve well under that. If one specific
  transition is just slow (cold app launch, a PIN screen, a network-backed screen), add an
  explicit longer `{ timeout }` to that one assertion — the PIN screens already do this at
  `20_000` in `tests/postLogin.spec.js`. Don't raise the global `actionTimeout` or
  `expect.timeout` to fix a single slow screen; that just slows down every other test's failure
  detection too.
- If a step is *optional* (a permission dialog, a promo sheet) rather than *slow*, that's not a
  timeout problem at all — use `tapIfVisible(locator, timeout)` or `present(locator)` from
  `pages/locator-utils.js` (already available via `BasePage`) so the flow skips it cleanly instead
  of waiting out a timeout for something that may never show.
- If failures are intermittent across runs with no code change, suspect global setup/device state
  before the test itself — `utils/global-setup.js` already retries its uninstall→install→onboard
  flow a few times for exactly this reason; a single bad run isn't necessarily a test bug.

## After fixing: prove it, don't just assert it

Re-run the healed test (and anything else that shares the touched page object or getter) via
`npx mobilewright test --grep "..."` and confirm it passes before calling the fix done. If you
changed a shared getter (e.g. something `ensureSignedIn()` or another page object depends on), run
the broader suite, not just the one test you started from.

If you're also adding net-new test coverage rather than fixing an existing break, that's the job
of this repo's test-writing skill, not this one.
