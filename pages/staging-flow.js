const { HomePage } = require('./home-page');
const { AccountMenuPage } = require('./account-menu-page');
const { OnboardingPage } = require('./onboarding-page');
const { SignInPage } = require('./sign-in-page');
const { present } = require('./locator-utils');

/**
 * Ported from btx-maestro's components/setup/select_server.yaml. Every
 * Maestro suite runs this before signing in — our mobilewright suite was
 * missing it entirely and has been signing into the PROD backend as a
 * result. Nine-dot menu -> Account -> Choose server -> Staging.
 *
 * Switching server restarts the app, which lands back on onboarding (see
 * the Maestro flow's own comment to that effect), so this waits out the
 * restart and re-runs OnboardingPage.complete() before returning.
 */
async function switchToStaging(screen) {
    const home = new HomePage(screen);
    const account = new AccountMenuPage(screen);
    const onboarding = new OnboardingPage(screen);

    await home.nineDotMenuButton.tap();
    await account.accountMenuItem.tap();
    await account.chooseServerOption.tap();
    await account.stagingOption.tap();

    await waitForRestartToSettle(screen, onboarding);
    await onboarding.complete();
}

/**
 * The restart triggered by the server switch is a much bigger disruption
 * than a normal screen transition (full app relaunch, not just navigation),
 * so this polls for any of the screens Maestro's own 30s extendedWaitUntil
 * accepts as "landed" rather than relying on OnboardingPage.complete()'s
 * shorter per-step timeouts, which assume a warm, already-loaded screen.
 */
async function waitForRestartToSettle(screen, onboarding, timeoutMs = 30_000) {
    const { signInLink } = new SignInPage(screen);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await present(onboarding.continueButton)) return;
        if (await present(onboarding.liteOption)) return;
        if (await present(signInLink)) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

module.exports = { switchToStaging };
