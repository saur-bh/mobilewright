# Writing a new test case

This project uses [Mobilewright](https://www.npmjs.com/package/@mobilewright/test), a
Playwright-style framework for driving the Bitfinex Android app. Tests are plain CommonJS
(`require`/`module.exports`) — no TypeScript, no build step.

See [CLAUDE.md](CLAUDE.md) for the full architecture writeup. This doc covers how to add a test
(sections 1-5), [running on PROD vs. Staging](#running-on-prod-vs-staging), and
[where tests run](#where-tests-run-local-browserstack-or-mobile-next) — local emulator, BrowserStack,
or Mobile Next.

## Before you start: know the fixture behavior

The `device` fixture from `@mobilewright/test` **terminates and relaunches the app before every
test**. Because the app is left signed-in-with-a-PIN by global setup
([utils/global-setup.js](utils/global-setup.js)), every test starts from the **PIN-lock screen**,
not the sign-in screen. Don't try to "fix" this — it's real app behavior.

So any new test that needs a signed-in session should start by unlocking the PIN, typically via
[`pages/auth-flow.js`](pages/auth-flow.js)'s `ensureSignedIn()` rather than re-implementing the
unlock steps.

## 1. Add the test to `tests/postLogin.spec.js`

There's currently one spec file. Add a new `test(...)` inside the existing
`test.describe('Authenticated session', ...)` block (or a new `describe` if you're testing an
unrelated flow):

```js
const { test, expect } = require('@mobilewright/test');
const { ensureSignedIn, WatchlistPage } = require('../pages');
const { patchDumpRetry } = require('../utils/dump-retry');

test('Some new behavior', async ({ screen }) => {
    patchDumpRetry(screen);           // always call this first, see below
    await ensureSignedIn(screen);     // precondition: resolves PIN-lock / sign-in / already-in-app

    // ... drive the screen(s) you care about, then assert ...
});
```

Use `ensureSignedIn(screen)` as the default precondition for any test that isn't specifically
testing login/onboarding/PIN itself — it resolves whichever of the three states (PIN-lock screen,
sign-in screen, already mid-session) the relaunch lands on, without the test needing to assume
one. Only drive `PinPage`/`SignInPage`/`OnboardingPage` directly when that flow *is* the thing
under test, the way the existing `Post-login: watchlist screen opens` test does.

Notes:
- **Always call `patchDumpRetry(screen)`** as the first line of the test body. It patches the
  fresh `screen`'s driver to transparently retry a flaky `uiautomator` dump — without it, a
  transient dump failure can fail your test for no real reason.
- Use page objects (`pages/`) for locators/actions and `expect(...).toBeVisible()` (imported from
  `@mobilewright/test`) for assertions. Page objects intentionally don't assert — that's the
  test's job.
- `actionTimeout` is `5_000` (down from the framework default of `30_000`, see
  [mobilewright.config.js](mobilewright.config.js)) — this keeps most locator waits fast. If a
  particular screen transition is known to be slow (e.g. PIN screens after a cold app state), pass
  an explicit longer timeout on that one assertion, e.g. `{ timeout: 20_000 }`, rather than
  raising the global timeout.

## 2. Add a page object for any new screen

If your test needs to interact with a screen that doesn't have a page object yet, add one under
`pages/`, modeled on the existing ones:

```js
// pages/some-screen-page.js
const { BasePage } = require('./base-page');

/** One-line description of what screen this represents. */
class SomeScreenPage extends BasePage {
    get someButton() {
        return this.screen.getByRole('text', { name: 'Some Button' });
    }

    get someField() {
        return this.screen.getByTestId('someTestId');
    }

    async doTheThing(value) {
        await this.someField.fill(value);
        await this.someButton.tap();
    }
}

module.exports = { SomeScreenPage };
```

Rules of thumb:
- **Extend `BasePage`** — it gives you `this.screen`, plus `this.tapIfVisible(locator, timeout)`
  and `this.present(locator)` for non-throwing existence/visibility probes (use these to make a
  flow idempotent/optional, e.g. skipping a permission dialog that may or may not appear).
- **Expose locators as getters, not assertions.** Don't do `await expect(...)` inside a page
  object — leave that to the calling test (different files import `expect` from different
  places: `@mobilewright/test` in specs, `mobilewright` in `global-setup.js`).
- **Action methods compose locators** (e.g. `signInWithApiKey()` in
  [pages/sign-in-page.js](pages/sign-in-page.js)) but stop short of asserting the result.
- Prefer `getByRole('text', { name: ... })` for visible text and `getByTestId(...)` /
  `getByLabel(...)` for elements with stable test IDs — check `npx mobilewright inspect` (see
  below) to find the right locator for a live element.
- Register the new page object in [pages/index.js](pages/index.js) so it's available from the
  barrel import: `const { SomeScreenPage } = require('../pages');`.

## 3. Add new test data/constants, not inline values

Credentials, PINs, and OS permissions live in `test-data/`, not inline in specs or page objects:
- [test-data/credentials.js](test-data/credentials.js) — `requireCredentials()` /
  `getApiCredentials()`, sourced from `.env` (`BFX_PROD_FULL_API_KEY` /
  `BFX_PROD_FULL_API_SECRET`).
- [test-data/pin.js](test-data/pin.js) — `DEFAULT_PIN`.
- [test-data/permissions.js](test-data/permissions.js) — `RUNTIME_PERMISSIONS` granted before
  first launch.

If your test needs a new fixture or constant (another test PIN variant, a new permission, etc.),
add it here and import it — don't hardcode it in the spec or page object.

## 4. Extend `ensureSignedIn()` only if the login/PIN flow itself changes

[pages/auth-flow.js](pages/auth-flow.js)'s `ensureSignedIn()` is the idempotent entry point that
composes onboarding → sign-in → PIN for any *future* spec that needs a signed-in session
regardless of the app's current screen. Don't duplicate its logic in a new test — call it. Only
edit it if the underlying onboarding/sign-in/PIN flow itself changes.

## 5. Run and iterate

```bash
npx mobilewright test --grep "Some new behavior"   # run just your new test
npx mobilewright test --list                        # sanity-check it's discovered
npx mobilewright inspect                             # live element/screenshot inspector,
                                                      # use this to find locators on a real device
```

Full suite:

```bash
npx mobilewright test
npx mobilewright test --reporter html && npx mobilewright show-report
```

Requires `.env` populated with `BFX_PROD_FULL_API_KEY` / `BFX_PROD_FULL_API_SECRET` (see
[utils/global-setup.js](utils/global-setup.js)), plus either a booted Android emulator/device
reachable via `adb` or a cloud provider — see
[Where tests run](#where-tests-run-local-browserstack-or-mobile-next) below to run the same suite
on BrowserStack or Mobile Next real devices instead.

On failure, check `test-results/` (gitignored) for the screenshot/video/view-tree JSON attached to
the failing test.

## Running on PROD vs. Staging

The target backend is toggled via the `STAGING=1` environment variable.

### Production (Default)

```bash
npx mobilewright test
```

- **Backend**: Connects to the default Production backend.
- **Credentials**: Reads `BFX_PROD_FULL_API_KEY` and `BFX_PROD_FULL_API_SECRET` from `.env`.
- **Account State**: Test assertions in [`tests/postLogin.spec.js`](tests/postLogin.spec.js) match the seeded data on this PROD account (username `saurabh-verma-auto2`, deposit history, verified name).

### Staging

```bash
STAGING=1 npx mobilewright test
```

- **Backend**: Switches the app to Staging during [global setup](utils/global-setup.js) via [`pages/staging-flow.js`](pages/staging-flow.js) (`nine-dot menu -> Account -> Choose server -> Staging`).
- **Credentials**: Reads `BFX_STAGING_API_KEY` and `BFX_STAGING_API_SECRET` from `.env`.
- **Account State**: PROD and Staging are separate account systems. The default Staging account currently lacks the seeded deposit/profile data that the PROD test suite asserts on, so tests asserting on account-specific data will fail. Tests that don't depend on seeded account data (e.g. watchlist, navigation bar) will pass:
  ```bash
  STAGING=1 npx mobilewright test --grep "watchlist|navigation bar"
  ```

### Standalone Staging Switch Preflight

To switch the connected device or emulator to Staging without running the full test suite (no reinstall or sign-in):

```bash
node scripts/preflight-staging.js
```

## Where tests run: local, BrowserStack, or Mobile Next

The same suite runs unchanged against three targets. Which one you get is chosen by an **explicit
environment flag** in [mobilewright.config.js](mobilewright.config.js) — never inferred from which
credentials happen to be present, so an ordinary `npx mobilewright test` can't silently end up on
paid cloud devices just because `.env` has cloud keys in it.

| Target | PROD (Default) | Staging | Needs |
| --- | --- | --- | --- |
| Local emulator/device (default) | `npx mobilewright test` | `STAGING=1 npx mobilewright test` | booted emulator reachable via `adb` |
| BrowserStack App Automate | `BROWSERSTACK=1 npx mobilewright test` | `STAGING=1 BROWSERSTACK=1 npx mobilewright test` | `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY` |
| Mobile Next Cloud | `MW_CLOUD=1 npx mobilewright test` | `STAGING=1 MW_CLOUD=1 npx mobilewright test` | `MOBILENEXT_API_KEY` |

Setting both cloud flags at once fails fast with a clear error rather than silently picking one,
and each cloud mode validates its credentials at config load — you get a named missing variable,
not a confusing failure partway through allocation.

### 1. Local Mobilewright setup (default)

Runs against a local Android emulator or physically attached device via `adb` and the local `mobilecli` driver.

**Prerequisites:**
- An active Android emulator running or a real device connected via USB.
- Android SDK and `adb` configured in your `$PATH`.

**Verify environment & devices:**
```bash
npx mobilewright doctor                         # check Xcode/Android SDK/adb/emulator setup
npx mobilewright devices                        # list connected devices and emulators
```

**Running tests:**
```bash
npx mobilewright test                           # run full suite on PROD
STAGING=1 npx mobilewright test                 # run on Staging backend
npx mobilewright test --grep "watchlist"        # run only matching tests
npx mobilewright test --list                    # list all discovered tests
npx mobilewright test --reporter html           # generate an HTML report
npx mobilewright show-report                    # view the last HTML report
```

**Live element inspector:**
```bash
npx mobilewright inspect                        # live accessibility tree & screenshot inspector
```

---

### 2. BrowserStack setup (`BROWSERSTACK=1`)

Driven by [`@browserstack/mobilewright`](https://www.npmjs.com/package/@browserstack/mobilewright),
BrowserStack's official App Automate driver. It requires `mobilewright >= 0.0.53` — the pins in
[package.json](package.json) are on `0.0.58` for this reason.

Populate these in `.env` (see [.env.example](.env.example)):

```bash
BROWSERSTACK_USERNAME=...
BROWSERSTACK_ACCESS_KEY=...
BROWSERSTACK_APP=bs://<app-id>     # optional but strongly recommended, see below
```

**Upload the APK once, not every run.** The APK in `app/android/` is ~290MB. If `BROWSERSTACK_APP`
is unset, the driver uploads that file on *every single run*. Upload it once and reuse the id:

```bash
curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@app/android/<your>.apk"
```

Put the returned `app_url` (`bs://...`) into `BROWSERSTACK_APP`. The config prefers it over the
local file and falls back to the local APK when it's unset.

**Running tests on BrowserStack:**
```bash
# PROD on BrowserStack (default Pixel 8):
BROWSERSTACK=1 npx mobilewright test

# Staging on BrowserStack:
STAGING=1 BROWSERSTACK=1 npx mobilewright test --grep "watchlist"

# Filter by test name:
BROWSERSTACK=1 npx mobilewright test --grep "watchlist"

# Generate and view HTML report:
BROWSERSTACK=1 npx mobilewright test --reporter html && npx mobilewright show-report
```

#### Choosing a BrowserStack device

`deviceName` is matched as a **regex**, so partial names work. Defaults to `Google Pixel 8`.

```bash
BROWSERSTACK=1 BROWSERSTACK_DEVICE="Samsung Galaxy S23" npx mobilewright test
BROWSERSTACK=1 BROWSERSTACK_OS_VERSION=">=13 <15" npx mobilewright test
```

| Variable | Purpose |
| --- | --- |
| `BROWSERSTACK_DEVICE` | Device name regex (default `Google Pixel 8`) |
| `BROWSERSTACK_OS_VERSION` | Range expression, e.g. `">=13 <15"` |
| `BROWSERSTACK_BUILD` | Build name in the dashboard (defaults to `local-<date>`) |

Session naming, pass/fail status, and dashboard links are handled automatically by the driver's
built-in observer — there's no reporter wiring to add.

#### Known issue: device resolution on `@browserstack/mobilewright@0.1.1`

[mobilewright.config.js](mobilewright.config.js) wraps the BrowserStack driver to patch a
round-trip bug. The driver's `listDevices()` reports each device's `id` as
`<device>-<os_version>` ("Google Pixel 8 Pro-14.0") while `name` stays bare
("Google Pixel 8 Pro"). Mobilewright's standalone launch path matches your `deviceName` regex
against `name`, then connects using `id` — and `connect()` feeds that id straight back in as a
*device-name pattern*, which is only ever tested against the bare device field. A composite can
never match a bare name, so **every** device fails with:

```
No android device matches name /Google Pixel 8 Pro-14.0/ in the App Automate catalog.
```

That path is the one [utils/global-setup.js](utils/global-setup.js) uses, so without the patch
setup can't complete — and no choice of `BROWSERSTACK_DEVICE` avoids it. The wrapper reports the
bare name as the id, closing the loop. Tests themselves never needed it: they go through the
device pool, which allocates first and attaches by session id.

Re-check whether the wrapper is still needed when bumping `@browserstack/mobilewright`.

---

### 3. Mobile Next Cloud setup (`MW_CLOUD=1`)

Runs the suite on remote real Android devices in Mobile Next Cloud via the built-in `mobilenext` driver.

**Populate `.env`:**
```bash
MOBILENEXT_API_KEY=your_mobilenext_api_key_here
```

**Running tests on Mobile Next Cloud:**
```bash
# PROD on Mobile Next Cloud:
MW_CLOUD=1 npx mobilewright test

# Staging on Mobile Next Cloud:
STAGING=1 MW_CLOUD=1 npx mobilewright test --grep "watchlist"

# Filter by test name and generate HTML report:
MW_CLOUD=1 npx mobilewright test --grep "watchlist" --reporter html && npx mobilewright show-report
```

### How global setup adapts

[utils/global-setup.js](utils/global-setup.js) does its uninstall → install → permission-grant →
sign-in → set-PIN sequence differently depending on the target, via its `isCloudDriver()` check:

- **Local** — shells out to `adb` (`pm grant`) to pre-grant `RUNTIME_PERMISSIONS`, so the OS
  permission dialogs never appear at all.
- **Cloud (either provider)** — there's no local shell on the device, so uninstall/install go
  through the driver, and permission dialogs are instead dismissed *in the UI* by
  `OnboardingPage`/`SignInPage`.

This means cloud runs genuinely exercise the permission dialogs that local runs skip. A flow that
passes locally can still fail on a cloud device if a dialog isn't handled — that's a real coverage
difference, not flakiness.

## Quick checklist for a new test

- [ ] Test lives in `tests/postLogin.spec.js` (or a new `tests/*.spec.js` file if it's an
      unrelated flow — update `testDir`-relative expectations accordingly).
- [ ] `patchDumpRetry(screen)` is the first line of the test body.
- [ ] Unlock/sign-in goes through `PinPage` / `ensureSignedIn()`, not duplicated inline.
- [ ] Any new screen has a page object under `pages/`, extending `BasePage`, registered in
      `pages/index.js`.
- [ ] Page object exposes locators/actions only; assertions (`expect(...).toBeVisible()`) live in
      the test.
- [ ] New constants/credentials go in `test-data/`, not hardcoded.
- [ ] Slow transitions get an explicit `{ timeout }` override instead of a global timeout bump.
