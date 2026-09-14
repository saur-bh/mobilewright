---
name: write-test-case
description: Use this whenever the user wants to add, write, or extend a test case, test, spec, page object, POM (page object model), or locator in this Mobilewright Android test-automation repo (btx-mw-prod) — e.g. "add a test for the Earn tab", "write a test case that checks the wallet balance", "create a page object for the trade screen", "test the bottom nav bar". Make sure to trigger this even if the user just describes a screen/flow they want covered without using the words "test" or "page object" explicitly — if they're asking to verify some app behavior in this repo, this skill applies.
---

# Writing a new test case in btx-mw-prod

This repo drives the Bitfinex Android app with Mobilewright (Playwright-style API, CommonJS, no
TypeScript) using a Page Object Model. Full architecture notes live in
[CLAUDE.md](../../../CLAUDE.md) and [README.md](../../../README.md) at the repo root — skim those
if anything here is ambiguous.

## The one fact that shapes every test

The `device` fixture **terminates and relaunches the app before every test**, and auto-installs
the APK first if it's missing from the device. Global setup leaves the app signed-in-with-a-PIN,
so every test normally starts at the **PIN-lock screen**, not the sign-in screen. Don't build a
workaround for this — it's real app behavior, not a bug.

**Precondition: start every test (other than one that's specifically testing login/onboarding
itself) with `ensureSignedIn(screen)`** from `pages/auth-flow.js`, not a hardcoded PIN-unlock.
It resolves all three states a test could find the app in — PIN-lock (unlocks it), sign-in screen
from a fresh install or a signed-out state (onboards, signs in via API key, sets a PIN), or already
mid-session (no-op) — so the rest of the test doesn't need to assume which one it'll hit. Only
reach for `PinPage`/`SignInPage`/`OnboardingPage` directly when the test's actual subject *is* that
screen (like the existing `Post-login: watchlist screen opens` test, which is deliberately
asserting the PIN-unlock flow itself works).

## Workflow

### 1. Work out what screen(s) and locators you need

If you don't already know the right locator (testId, role+name, label) for the element(s) under
test, find it before writing anything:

```bash
npx mobilewright inspect    # live element/screenshot inspector against the connected device
```

Prefer, in this order: `getByTestId('...')` (most stable — survives text/copy changes) >
`getByRole('text', { name: '...' })` for visible text > `getByLabel('...')`. Check the existing
page objects under `pages/` for the pattern already used on nearby screens before inventing a new
one.

### 2. Add or extend a page object

Look in `pages/` for a page object already covering the screen. If one exists, add the new
locator/action as another getter/method on it. If the screen has no page object yet, create one:

```js
// pages/some-screen-page.js
const { BasePage } = require('./base-page');

/** One-line description of what screen this represents. */
class SomeScreenPage extends BasePage {
    get someButton() {
        return this.screen.getByTestId('Some-Test-Id');
    }

    async doTheThing(value) {
        await this.someField.fill(value);
        await this.someButton.tap();
    }
}

module.exports = { SomeScreenPage };
```

Rules that keep page objects consistent with the rest of the codebase:

- **Extend `BasePage`.** It supplies `this.screen`, plus `this.tapIfVisible(locator, timeout)` and
  `this.present(locator)` — non-throwing probes for steps that may or may not appear (an OS
  permission dialog, a "skip" button). Use these for genuinely optional steps, not to paper over a
  locator you're unsure about.
- **Expose locators and actions, never assertions.** Don't write `await expect(...)` inside a page
  object. The test file owns assertions — and the right `expect` import differs between specs
  (`@mobilewright/test`) and `global-setup.js` (`mobilewright`), so assertions belong at the call
  site that already has the right import.
- **Action methods compose locators** (see `signInWithApiKey()` in `pages/sign-in-page.js`) but
  stop at performing the action — they don't verify it worked.
- **Register the class in `pages/index.js`** (`...require('./some-screen-page')`) so it's
  available from the barrel import other files use: `const { SomeScreenPage } = require('../pages');`.

### 3. Put new constants/credentials in `test-data/`, not inline

`test-data/` holds data, not behavior — `credentials.js`, `pin.js`, `permissions.js`. If your test
needs a new fixture (another PIN variant, a new OS permission, a feature flag value), add it there
and import it rather than hardcoding it in the page object or spec.

### 4. Write the test in `tests/postLogin.spec.js`

There's one spec file today; add your test inside `test.describe('Authenticated session', ...)`
(or a new `describe` block if the flow is genuinely unrelated to the authenticated-session suite):

```js
const { test, expect } = require('@mobilewright/test');
const { ensureSignedIn, SomeScreenPage } = require('../pages');
const { patchDumpRetry } = require('../utils/dump-retry');

test('Some new behavior', async ({ screen }) => {
    patchDumpRetry(screen);           // first line, every time — see why below
    await ensureSignedIn(screen);     // precondition — don't assume PIN-lock vs sign-in vs mid-session

    const target = new SomeScreenPage(screen);
    await expect(target.someButton).toBeVisible();
    // ... drive the flow, then assert the outcome ...
});
```

Why `patchDumpRetry(screen)` matters: the device's `uiautomator` dump can fail transiently
mid-transition, and the framework's locator polling doesn't retry a raw dump failure on its own —
only a "not found yet" state. Skipping this patch means an unrelated, transient dump hiccup can
fail your test for no real reason. Call it once, as the first line, for every fresh `screen`.

Timeout defaults: `actionTimeout` is `5_000` (tuned down from the framework's `30_000` — see
`mobilewright.config.js`), so most locator waits resolve fast. Where you know a specific transition
is slow — the PIN screens after a cold launch are the existing example, at `{ timeout: 20_000 }` —
pass that explicit longer timeout on the one assertion that needs it. Don't raise the global
timeout to fix one slow screen.

### 5. Run it

```bash
npx mobilewright test --grep "Some new behavior"   # run just the new test
npx mobilewright test --list                         # confirm it's discovered
npx mobilewright test --reporter html && npx mobilewright show-report   # full run + HTML report
```

Needs a booted Android emulator/device reachable via `adb` (`npx mobilewright devices` to check)
and `.env` populated with `BFX_PROD_FULL_API_KEY` / `BFX_PROD_FULL_API_SECRET`.

On failure, `test-results/` (gitignored) holds the screenshot, video, and view-tree JSON for the
failing test, named after its `describe`/`test` titles — read those before guessing at a fix. If
the failure looks like a broken/stale locator or dump/driver flakiness rather than a real test bug,
that's a different job — hand it to whatever skill in this repo covers diagnosing and healing
locator/flakiness failures rather than solving it from first principles here.

## Checklist

- [ ] Locator(s) confirmed against the live app (`npx mobilewright inspect`) or taken from an
      existing page object for the same screen.
- [ ] New/changed screen has a page object under `pages/`, extends `BasePage`, registered in
      `pages/index.js`.
- [ ] Page object exposes locators/actions only — assertions live in the test.
- [ ] New constants/credentials go in `test-data/`, not hardcoded.
- [ ] Test added to `tests/postLogin.spec.js`, starts with `patchDumpRetry(screen)`.
- [ ] Test starts with `await ensureSignedIn(screen);` (unless it's specifically testing
      login/onboarding/PIN itself) rather than assuming a starting screen.
- [ ] Slow transitions get an explicit `{ timeout }` override, not a global timeout bump.
- [ ] Ran via `npx mobilewright test --grep "<name>"` and it passes.
