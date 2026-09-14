# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

An end-to-end UI test suite for the Bitfinex Android app (`com.bitfinex.mobileapp.dev`), written against
**Mobilewright** — a Playwright-style mobile automation framework (`mobilewright` / `@mobilewright/test`)
that drives real devices/emulators over `mobilecli` using the device's accessibility tree (no XPath, no
vision model). Plain CommonJS (`require`/`module.exports`) — no TypeScript, no build step. There is no
application source code here — only the test project (config, specs, page objects, and test data) plus
the APK under test (`app/newapp.apk`). Organized as a Page Object Model: `pages/` holds per-screen locators
and actions, `test-data/` holds credentials/PIN/permissions, `tests/` holds specs, and `utils/` holds
cross-cutting test infra (global setup, the dump-retry patch).

## Commands

There are no `package.json` scripts; tests run through the `mobilewright` CLI (installed as a dev
dependency, invoke via `npx`).

```bash
npm install                                     # install dependencies

npx mobilewright doctor                         # verify Xcode/Android SDK/adb/emulator setup
npx mobilewright devices                        # list connected devices/emulators/simulators

npx mobilewright test                           # run the suite (global setup + tests/postLogin.spec.js)
npx mobilewright test --grep "watchlist"        # run tests matching a name
npx mobilewright test --list                    # list discovered tests without running them
npx mobilewright test --reporter html           # generate an HTML report
npx mobilewright show-report                    # open the last HTML report

npx mobilewright inspect                        # live element/screenshot inspector for a connected device
```

Requires a booted Android emulator/device reachable via `adb` — this project is hard-configured for
`platform: 'android'` in `mobilewright.config.js`. There's only one spec file (`tests/postLogin.spec.js`),
so there's rarely a need to target a single file — `npx mobilewright test` already runs just it.

### Required environment

`utils/global-setup.js` calls `requireCredentials()` (from `test-data/credentials.js`) and will throw
immediately unless `.env` (loaded via `dotenv/config`) defines:

- `BFX_PROD_FULL_API_KEY`
- `BFX_PROD_FULL_API_SECRET`

These are the API key/secret used to sign in through the app's "Sign in via API Key" flow.

## Architecture

**`mobilewright.config.js`** is the single source of truth for how the suite runs: `testDir: ./tests`,
`globalSetup: ./utils/global-setup.js`, the target `bundleId`/`installApps` (APK), and tuned timeouts.
Notably `actionTimeout` is set to `5_000` down from the framework default of `30_000` — called out in a
comment as "your main bottleneck" — so new flows should be written assuming short per-action timeouts and
explicit longer `{ timeout }` overrides on slow assertions (see the PIN screens, which use 20s timeouts).

**`pages/`** is the Page Object Model layer — one class per screen, each constructed with the `screen`
fixture (`new SomePage(screen)`) and exposing locators as getters plus action methods that compose them:
- `base-page.js` — `BasePage` constructor (`this.screen`) plus `tapIfVisible`/`present` wrappers every
  page object gets for free.
- `locator-utils.js` — the underlying standalone `tapIfVisible`/`present` functions (non-throwing
  existence/visibility probes that make flows idempotent — skip a step instead of failing when a screen
  doesn't appear). Exported separately so non-page code (like `auth-flow.js`) can use them too.
- `onboarding-page.js`, `sign-in-page.js`, `pin-page.js`, `watchlist-page.js` — one per screen in the
  onboarding → sign-in → PIN → watchlist journey.
- `auth-flow.js` — `ensureSignedIn()`, an idempotent entry point that composes the page objects above;
  any *future* spec can call it regardless of whether the app is already past login, at a PIN prompt, or
  at the sign-in screen, without paying for a login it doesn't need.
- `index.js` — barrel export (spreads each module's `module.exports`); import page objects as
  `const { PinPage, WatchlistPage } = require('../pages');`.

Page objects expose **locators, not assertions** — callers do `await expect(page.someLocator).toBeVisible()`
themselves, since the right `expect` import differs between test files (`@mobilewright/test`) and
`global-setup.js` (`mobilewright`, since fixtures aren't available outside the test runner).

**`test-data/`** holds data, not behavior: `credentials.js` (`requireCredentials`/`getApiCredentials`,
reading `BFX_PROD_FULL_API_KEY`/`SECRET` from `.env`), `pin.js` (`DEFAULT_PIN`), and `permissions.js`
(`RUNTIME_PERMISSIONS`, the OS permissions pre-granted before first launch). Add new fixtures/constants
here rather than inlining them in a page object or spec.

**`utils/global-setup.js` is the precondition/smoke setup, not a test.** It runs once before the suite and
does the "is my environment actually working" checks by hand, outside the test framework (using the raw
`android` launcher from `mobilewright`, not `@mobilewright/test`, since fixtures aren't available in
`globalSetup`): uninstall → install → grant `RUNTIME_PERMISSIONS` via `adb pm grant` (so the OS
notification/camera dialogs never appear rather than racing their timing) → launch → onboarding (via the
page objects) → sign in → create PIN. It retries the whole flow from a clean uninstall a few times on
failure, since a stuck on-device automation process (see below) or a genuine transient dump error can
otherwise fail a whole run. This leaves the device signed in with a PIN set, so `tests/postLogin.spec.js`
always starts from the PIN-lock screen the `device` fixture's per-test relaunch shows.

**`tests/postLogin.spec.js` is the one real test.** The `@mobilewright/test` `device` fixture terminates
and relaunches the app before *every* test (see `node_modules/@mobilewright/test/dist/fixtures.js`), which
is exactly why a signed-in app comes back to the PIN-lock screen rather than the sign-in screen — that's
real app behavior, not a bug to route around. The test unlocks via `PinPage` and asserts the watchlist
screen (`WatchlistPage.buildWatchlistPrompt`) actually opens — don't add unrelated tests to this file;
anything that needs a signed-in session belongs after the same PIN-unlock pattern, likely using
`pages/auth-flow.js`'s `ensureSignedIn()` instead of duplicating it.

**`utils/dump-retry.js`** exports `patchDumpRetry(screen)`, called once per fresh `screen` (in both
`global-setup.js` and `postLogin.spec.js`). The device's `uiautomator` dump can fail transiently
mid-transition, or hang/fail outright if a previous dump attempt was killed and left its instrumentation
process holding the device's exclusive UiAutomation connection (if `adb shell uiautomator dump` itself
hangs or every locator call fails identically, check `adb shell ps -A | grep app_process` for an orphaned
process and kill it). The framework's own locator polling doesn't retry a raw dump failure, only a "not
found yet" state, so this patches the screen's driver to retry transparently for every locator call.

Test artifacts (screenshots, videos, view-tree JSON attached via `viewTree: 'on-failure'`) are written to
`test-results/` (gitignored) and are named after the `describe`/`test` titles.
