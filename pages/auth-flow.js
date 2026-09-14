const { OnboardingPage } = require('./onboarding-page');
const { SignInPage } = require('./sign-in-page');
const { PinPage } = require('./pin-page');
const { present } = require('./locator-utils');
const { getApiCredentials } = require('../test-data/credentials');

/**
 * The standard precondition guard for any test that needs a working session
 * rather than testing login itself. Covers all three states a test can find
 * the app in after the `device` fixture's relaunch:
 *   - PIN-lock screen (installed + previously signed in)  -> unlock with PIN
 *   - sign-in screen (fresh install, or previously signed out) -> onboard,
 *     sign in via API key, set a PIN
 *   - already inside the app (mid-session) -> no-op
 * "Is the app installed" isn't this function's job — the `device` fixture
 * already auto-installs `installApps` before every test if missing (see
 * node_modules/@mobilewright/test/dist/fixtures.js), so by the time a test
 * gets `screen` the app is guaranteed installed; this only has to resolve
 * the signed-in/signed-out branch above. Costs two no-wait probes when
 * already signed in, so any spec can call it without paying for a login it
 * doesn't need.
 */
async function ensureSignedIn(screen) {
    const pin = new PinPage(screen);
    if (await present(pin.enterPinPrompt)) {
        await pin.enter();
        return;
    }

    const signIn = new SignInPage(screen);
    if (!(await present(signIn.signInLink))) {
        return; // already inside the app
    }

    const onboarding = new OnboardingPage(screen);
    await onboarding.complete();
    await signIn.signInWithApiKey(getApiCredentials());
    await pin.setUp();
}

module.exports = { ensureSignedIn };
