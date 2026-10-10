# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

An end-to-end UI test suite for the Bitfinex Android app (`com.bitfinex.mobileapp.dev`), written against
**Mobilewright** — a Playwright-style mobile automation framework (`mobilewright` / `@mobilewright/test`)
that drives real devices/emulators over `mobilecli` using the device's accessibility tree (no XPath, no
vision model). Plain CommonJS (`require`/`module.exports`) — no TypeScript, no build step. There is no
application source code here — only the test project (config, specs, page objects, and test data) plus
the APK under test (`app/android/*.apk`). Organized as a Page Object Model: `pages/` holds per-screen locators
and actions, `test-data/` holds credentials/PIN/permissions, `tests/` holds specs, and `utils/` holds
cross-cutting test infra (global setup, the dump-retry patch).

## Commands

There are no `package.json` scripts; tests run through the `mobilewright` CLI (installed as a dev
dependency, invoke via `npx`).

```bash
npm install                                     # install dependencies

npx mobilewright doctor                         # verify Xcode/Android SDK/adb/emulator setup
npx mobilewright devices                        # list connected devices/emulators/simulators

npx mobilewright test                           # run the suite (global setup + all 6 tests/postLogin.spec.js tests)
npx mobilewright test --grep "watchlist"        # run tests matching a name
npx mobilewright test --grep "2FA"              # e.g. just the Withdraw test
npx mobilewright test --list                    # list discovered tests without running them
npx mobilewright test --reporter html           # generate an HTML report
npx mobilewright show-report                    # open the last HTML report

npx mobilewright inspect                        # live element/screenshot inspector for a connected device

node scripts/preflight-staging.js               # standalone: just switch the device to Staging
```

Requires a booted Android emulator/device reachable via `adb` — this project is hard-configured for
`platform: 'android'` in `mobilewright.config.js`. There's only one spec file (`tests/postLogin.spec.js`,
six tests covering post-login/nav, Home, Buy Crypto, Deposit, and Withdraw), so `--grep` is the way to
target one test rather than a separate file.

### Required environment

`utils/global-setup.js` requires (via `test-data/credentials.js`), and will throw immediately if `.env`
(loaded via `dotenv/config`) is missing, whichever pair below its target backend needs:

- `BFX_PROD_FULL_API_KEY` / `BFX_PROD_FULL_API_SECRET` — the PROD account the suite signs into **by
  default**. Its data (username, deposit history, verified name) is exactly what most of
  `tests/postLogin.spec.js`'s assertions check, so this is the pair that actually matters day to day.
- `BFX_STAGING_API_KEY` / `BFX_STAGING_API_SECRET` — a Staging account (currently btx-maestro's default
  test account, ported over), used only when `STAGING=1` is set (see below). It has none of the PROD
  account's seeded data, so most of the suite's assertions don't hold against it yet.

### PROD vs. Staging

The suite signs into **PROD by default**. Set `STAGING=1` to instead switch the app to the Staging
backend (via `pages/staging-flow.js`, before sign-in) and sign into the Staging account instead:

```bash
npx mobilewright test              # default: PROD backend, PROD account
STAGING=1 npx mobilewright test    # Staging backend, Staging account
```

This is a real, empirically-confirmed account split, not just an env-var naming choice: signing into
Staging with the PROD account's keys was tested directly and just sits on the login form — PROD and
Staging are separate account systems. Since the Staging account ported over from btx-maestro has none of
the PROD account's seeded data, `STAGING=1` today still fails every assertion in `tests/postLogin.spec.js`
that checks account-specific state (the signed-in username, a specific deposit by date, a verified name)
— watchlist, nav bar, and Buy Crypto pass; Home, Deposit, and Withdraw don't yet. Use `STAGING=1` once
there's a Staging account seeded to match, or when adding a new Staging-only test; otherwise leave it
unset. `utils/global-setup.js` and `pages/auth-flow.js` both read this same toggle — keep them in sync if
you change how it's read.

Staging also differs from PROD in ways that have nothing to do with account data: Bitcoin's Mercuryo
wallet is under maintenance on Staging (confirmed via the app's own on-screen banner, "Wallet for BTC is
currently under maintenance"), which leaves `MercuryoPage.walletAddressText` permanently empty for BTC
there. The Buy Crypto test picks Ethereum instead when `STAGING=1` — see the `useStaging` branch around
`mercuryo.assetPickerItem()`. If a future Staging-only test needs a different environment-specific
workaround, follow that same pattern (branch on the toggle, don't change the PROD default path).

## Architecture

**`mobilewright.config.js`** is the single source of truth for how the suite runs: `testDir: ./tests`,
`globalSetup: ./utils/global-setup.js`, the target `bundleId`/`installApps` (APK), and tuned timeouts.
Notably `actionTimeout` is set to `5_000` down from the framework default of `30_000` — called out in a
comment as "your main bottleneck" — so new flows should be written assuming short per-action timeouts and
explicit longer `{ timeout }` overrides on slow assertions (see the PIN screens, which use 20s timeouts).
It also picks between three device targets via env flags, mutually exclusive, checked at config-load time:

```bash
npx mobilewright test                 # default: local emulator, APK auto-found under app/android/
MW_CLOUD=1 npx mobilewright test      # Mobile Next Cloud real devices (needs MOBILENEXT_API_KEY)
BROWSERSTACK=1 npx mobilewright test  # BrowserStack App Automate (needs BROWSERSTACK_USERNAME/ACCESS_KEY)
```

The local path resolves the APK dynamically (`getApkPath('./app/android')` — first `.apk` file found in
that directory, so don't drop more than one APK there). The path it returns must stay **absolute**:
installs are an RPC to the long-running mobilecli server, which runs `adb install` from its own working
directory, so a relative path only works when that server happened to start in the project root
(`adb: failed to stat ./app/android/...` otherwise); BrowserStack prefers an already-uploaded
`bs://<app-id>` (`BROWSERSTACK_APP`) over re-uploading the ~290MB APK on every run.

**`pages/`** is the Page Object Model layer — one class per screen, each constructed with the `screen`
fixture (`new SomePage(screen)`) and exposing locators as getters plus action methods that compose them:
- `base-page.js` — `BasePage` constructor (`this.screen`) plus `tapIfVisible`/`present` wrappers every
  page object gets for free.
- `locator-utils.js` — the underlying standalone `tapIfVisible`/`present` functions (non-throwing
  existence/visibility probes that make flows idempotent — skip a step instead of failing when a screen
  doesn't appear). Exported separately so non-page code (like `auth-flow.js`) can use them too.
- `onboarding-page.js`, `sign-in-page.js`, `pin-page.js`, `watchlist-page.js` — one per screen in the
  onboarding → sign-in → PIN → watchlist journey.
- `home-page.js`, `navigation-bar-page.js`, `account-menu-page.js`, `live-chat-page.js` — the post-login
  Home screen, its bottom tab bar, the nine-dot menu's account screen, and the live-chat webview.
- `buy-crypto-page.js`, `mercuryo-page.js`, `mercuryo-tos-page.js` — the Buy Crypto card-provider picker
  and the Mercuryo widget flow reached from it.
- `deposit-page.js`, `deposit-support-page.js`, `recent-deposits-page.js`, `deposit-currency-fees-page.js`,
  `openpayd-notice-page.js` — the Deposit screen and the sub-screens reached from it (FAQ article, history,
  fiat fee options, the OpenPayd third-party notice).
- `withdraw-page.js`, `withdraw-address-page.js`, `withdraw-compliance-page.js` — the Withdraw screen, the
  per-asset withdrawal form (invoice/address, note, T&Cs/Travel Rule checkboxes), and the Travel Rule
  recipient-declaration → 2FA sub-flow. Two non-obvious things learned writing the Withdraw test, worth
  knowing before touching either of these:
  - **A tap meant to dismiss a field's keyboard has to land on something that stays in the viewport once
    that field is focused.** `WithdrawAddressPage`'s multi-line note field pans/resizes the screen on
    focus, so a "dismiss" tap aimed at the screen title (top of screen) actually landed on the keyboard
    underneath instead — confirmed on video (a stray keystroke got typed) after every step past it
    silently no-opped: the elements behind the keyboard were still "visible" in the accessibility tree
    (logical visibility), just visually covered, so their taps kept hitting the keyboard instead. Tap a
    label that's guaranteed to sit right next to the field instead (see `noteLabel`).
  - **A disabled/read-only `EditText`'s content can still only be a "text" field, never a "value" field,
    in mobilecli's UI dump** — same as `MercuryoPage.amountInput`. `toHaveValue()`/`getValue()` read as
    permanently empty regardless of timing; assert with `toBeVisible()`/`getText()` against a locator
    keyed on the expected text instead (see `WithdrawCompliancePage.nameField()`, and note it needs
    `getByText`, not `getByRole('textfield', {name})` — the latter matches an accessible label/name
    attribute, which these fields don't have, not raw text content).
- `auth-flow.js` — `ensureSignedIn()`, an idempotent entry point that composes the page objects above;
  any *future* spec can call it regardless of whether the app is already past login, at a PIN prompt, or
  at the sign-in screen, without paying for a login it doesn't need.
- `staging-flow.js` — `switchToStaging(screen)`, ported from btx-maestro's
  `components/setup/select_server.yaml`: nine-dot menu → Account → Choose server → Staging. Switching
  restarts the app (lands back on onboarding — the Maestro source flow calls this out explicitly), so it
  polls for the restart to settle before re-running `OnboardingPage.complete()`. `utils/global-setup.js`
  runs this right after onboarding and before sign-in, every run — every Maestro suite does the same
  before its own login step, and without it the app just stays on whatever backend it shipped pointed at
  (PROD, for this build). `scripts/preflight-staging.js` runs just this step standalone.
- `index.js` — barrel export (spreads each module's `module.exports`); import page objects as
  `const { PinPage, WatchlistPage } = require('../pages');`.

Page objects expose **locators, not assertions** — callers do `await expect(page.someLocator).toBeVisible()`
themselves, since the right `expect` import differs between test files (`@mobilewright/test`) and
`global-setup.js` (`mobilewright`, since fixtures aren't available outside the test runner).

**`test-data/`** holds data, not behavior: `credentials.js` (`{require,get}ProdApiCredentials` and
`{require,get}StagingApiCredentials` — two distinct pairs, see "PROD vs. Staging" above; don't merge them
back into one generic accessor), `pin.js` (`DEFAULT_PIN`), `permissions.js` (`RUNTIME_PERMISSIONS`, the OS
permissions pre-granted before first launch), and `lightning-invoice.js`
(`generateLightningWithdrawalInvoice`, used by the Withdraw test — deliberately always uses
`getProdApiCredentials()` regardless of the `STAGING` toggle, since it signs REST calls straight against
Bitfinex's production API at `api.bitfinex.com`, unrelated to which backend the app UI is pointed at). Add
new fixtures/constants here rather than inlining them in a page object or spec.

**`utils/global-setup.js` is the precondition/smoke setup, not a test.** It runs once before the suite and
does the "is my environment actually working" checks by hand, outside the test framework (using the raw
`android` launcher from `mobilewright`, not `@mobilewright/test`, since fixtures aren't available in
`globalSetup`): uninstall → install → grant `RUNTIME_PERMISSIONS` via `adb pm grant` (so the OS
notification/camera dialogs never appear rather than racing their timing) → launch → onboarding (via the
page objects) → sign in → create PIN. It retries the whole flow from a clean uninstall a few times on
failure, since a stuck on-device automation process (see below) or a genuine transient dump error can
otherwise fail a whole run. This leaves the device signed in with a PIN set, so `tests/postLogin.spec.js`
always starts from the PIN-lock screen the `device` fixture's per-test relaunch shows.

**`tests/postLogin.spec.js` is the only spec file, with six tests.** The `@mobilewright/test` `device`
fixture terminates and relaunches the app before *every* test (see
`node_modules/@mobilewright/test/dist/fixtures.js`), which is exactly why a signed-in app comes back to
the PIN-lock screen rather than the sign-in screen — that's real app behavior, not a bug to route around.
The first two tests unlock via `PinPage` directly (asserting the watchlist opens, then that the nav bar's
tabs are all present); the other four call `ensureSignedIn()` first (it also handles the PIN-lock case,
just via `pages/auth-flow.js` instead of inline) before walking a real screen flow — Home's nine-dot
menu/live chat, Buy Crypto → Mercuryo, Deposit and its sub-screens, and Withdraw through 2FA. New tests
that need a signed-in session should follow that same `ensureSignedIn()` pattern rather than duplicating
the PIN-unlock logic inline.

**`utils/dump-retry.js`** exports `patchDumpRetry(screen)`, called once per fresh `screen` (in both
`global-setup.js` and `postLogin.spec.js`). The device's `uiautomator` dump can fail transiently
mid-transition, or hang/fail outright if a previous dump attempt was killed and left its instrumentation
process holding the device's exclusive UiAutomation connection (if `adb shell uiautomator dump` itself
hangs or every locator call fails identically, check `adb shell ps -A | grep app_process` for an orphaned
process and kill it). The framework's own locator polling doesn't retry a raw dump failure, only a "not
found yet" state, so this patches the screen's driver to retry transparently for every locator call.

Test artifacts (screenshots, videos, view-tree JSON attached via `viewTree: 'on-failure'`) are written to
`test-results/` (gitignored) and are named after the `describe`/`test` titles.
