# Writing a new test case

This project uses [Mobilewright](https://www.npmjs.com/package/@mobilewright/test), a
Playwright-style framework for driving the Bitfinex Android app. Tests are plain CommonJS
(`require`/`module.exports`) — no TypeScript, no build step.

See [CLAUDE.md](CLAUDE.md) for the full architecture writeup. This doc is just the "how do I add
a test" walkthrough.

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

Requires a booted Android emulator/device reachable via `adb`, and `.env` populated with
`BFX_PROD_FULL_API_KEY` / `BFX_PROD_FULL_API_SECRET` (see
[utils/global-setup.js](utils/global-setup.js)).

On failure, check `test-results/` (gitignored) for the screenshot/video/view-tree JSON attached to
the failing test.

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
