---
name: automate-manual-test-case
description: Use this whenever the user hands over a manual test case — numbered steps, a short script, a bug-report repro, or plain-English "first do X, then tap Y, then verify Z" — for the Bitfinex Android app and wants it turned into an automated test in this Mobilewright repo (btx-mw-prod). Trigger on phrasing like "here are the steps, automate this", "turn this manual test case into a script", "can you write a test from these steps", or a pasted QA test-case doc. This differs from freeform new-test authoring in that the user is handing over an already-specified sequence to translate step-by-step, screen-by-screen — don't skip ahead by guessing screens or locators from the step wording alone, and don't drop or reorder steps.
---

# Converting a manual test case into an automated one

The input here is someone else's already-written test case — a QA step list, a bug repro, a
"how to verify this" note. Your job is a faithful translation into Mobilewright code, not a
rewrite. Two things make this different from writing a test from scratch: you don't get to invent
the flow (it's already specified, in order), and you shouldn't trust the step's wording for exact
locators — confirm each one against the live app before coding it.

## Step 1: read the manual case as a literal sequence

List out each discrete action/verification in the manual case, in order, before writing any code.
Don't merge steps, skip ones that look redundant, or silently reorder them — if a step is
genuinely ambiguous about which screen or element it means, make the most reasonable reading and
note the assumption when you report back, rather than guessing silently or stalling on it.

Classify each step as one of:
- an **action** (tap, fill, swipe, navigate)
- a **verification** ("should see", "check that", "confirm")
- a **precondition** ("given the user is logged in", "starting from the home screen")

## Step 2: handle the precondition first — don't assume app/login state

Almost every manual case implicitly assumes "the app is open and I'm logged in" as step zero, even
when it's not written down. In this repo that's not a safe assumption to hardcode — the `device`
fixture relaunches the app before every test, and can land on the PIN-lock screen, the sign-in
screen, or mid-session depending on what happened before. Resolve it explicitly instead of
hardcoding a screen:

```js
const { test, expect } = require('@mobilewright/test');
const { ensureSignedIn } = require('../pages');
const { patchDumpRetry } = require('../utils/dump-retry');

test('<name from the manual case>', async ({ screen }) => {
    patchDumpRetry(screen);
    await ensureSignedIn(screen);   // resolves PIN-lock / sign-in / already-in-app for you
    // ... the manual case's actual steps start here ...
});
```

`ensureSignedIn()` (from `pages/auth-flow.js`) is exactly the three-way check this situation needs:
if the app is at the PIN-lock screen it unlocks; if it's at the sign-in screen (fresh install or
signed out) it onboards, signs in with the API key credentials, and sets a PIN; if it's already
mid-session it does nothing. "Is the app installed at all" doesn't need separate handling — the
test fixture itself auto-installs the configured APK before every test if it's missing. So you
never need to write your own install-then-login-then-proceed branching; this one call covers it.

The only exception: if the manual case is *specifically* testing the install/onboarding/login/PIN
flow itself (e.g. "verify a new user can sign up"), don't call `ensureSignedIn()` — drive
`OnboardingPage`/`SignInPage`/`PinPage` directly, the way the existing
`Post-login: watchlist screen opens` test in `tests/postLogin.spec.js` does, since that's the
thing under test.

## Step 3: for each remaining step, confirm the locator before coding it

This is the part that's easy to get wrong by pattern-matching on the manual case's prose. A step
that says "tap the Earn tab" is a *description* of intent, not a guarantee that a locator named
`Earn` exists — the real testId/role/text could be anything. Before writing a locator:

```bash
npx mobilewright inspect    # live element/screenshot inspector against the connected device
```

Drive the app to the screen the step refers to and read off the actual testId (preferred), or
role+name / label, from the inspector. Don't write `getByTestId('Earn')` because the manual step
used the word "Earn" — write what `inspect` actually shows for that element.

For each step, once you have the real locator:

- **Action step** → add/extend a locator+method on the relevant page object under `pages/`
  (extend `BasePage`, expose locators/actions only — see the `write-test-case` skill for the full
  page-object conventions if you're creating a new one), then call it from the test.
- **Verification step** → an `expect(locator).toBeVisible()` (or the matcher matching what the
  step is actually checking — text content, enabled state, etc.) in the **test**, not inside the
  page object. Page objects never assert.
- If a page object for that screen already exists, check whether it already exposes what you
  need before adding a near-duplicate getter.
- If `inspect` shows that an *existing* page object's locator no longer matches what's on screen
  (the app changed since that page object was written), that's a different problem — stale
  locator repair is the `locator-healer` skill's job, not something to quietly route around here
  by adding a second, parallel locator for the same element.

### A step that verifies content inside a webview

If a step says to verify text/content that lives inside an embedded webview (a live-chat widget,
a help-center page, anything rendered as HTML rather than native views), check for this specific
trap before assuming it's just another locator to find:

1. `screen.getByWebView().page()` is Mobilewright's only supported way to query inside a webview,
   and it requires the app to be built with `android:debuggable="true"` (see
   mobilewright.dev/docs/guides/webviews). Most release-style QA builds (like `app/newapp.apk` in
   this repo) aren't debuggable, and the call fails outright with `RpcError: webview injection
   requires a debug build`.
2. Don't assume the native accessibility tree can see the text as a fallback either — check first.
   It sometimes can for platforms/components that flatten webview content into native-looking
   nodes, but it isn't guaranteed: dump the view hierarchy at that exact screen
   (`screen.driver.getViewHierarchy()`, or reason from a `viewTree`/failure artifact) and look for
   whether the webview contributes *any* node, native-looking or not. On this app's Live Chat
   screen it contributes none at all — the whole chat widget is invisible to the dump, only the
   native toolbar around it (title, back/refresh/close icons) shows up.
3. If neither path can see the text, don't force it — assert on the nearest native signal that
   proves the right screen/state was reached (a toolbar title, a header label) as the closest
   available proxy, and say plainly in the test (a comment) and in your report to the user that the
   literal content check isn't possible without a debuggable build, rather than silently writing a
   locator that happens to never match, or quietly dropping the verification.

## Step 4: assemble the test in manual-case order

Add the test to `tests/postLogin.spec.js` (or wherever the `write-test-case` skill's conventions
say for an unrelated flow), with the precondition first, then one block per manual step in the
original order. A short comment tying each block back to its source step makes the generated test
reviewable against the original case:

```js
test('Earn: APY shows on the product detail screen', async ({ screen }) => {
    patchDumpRetry(screen);
    await ensureSignedIn(screen);

    // Step 1: open the Earn tab
    const nav = new NavigationBarPage(screen);
    await nav.earnTab.tap();

    // Step 2: open the USD product
    const earn = new EarnPage(screen);
    await earn.usdProduct.tap();

    // Step 3: verify the APY is shown
    await expect(earn.apyLabel).toBeVisible();
});
```

## Step 5: run it and reconcile against the original case

```bash
npx mobilewright test --grep "<test name>"
```

Before calling it done, check every verification step in the manual case has a corresponding
`expect(...)` in the generated test — don't silently drop a check because it was awkward to
automate. If a step genuinely can't be automated as written (it depends on something outside this
framework's control — a backend data state, a second device, a time-of-day condition), say so
explicitly when reporting back rather than quietly omitting it.
