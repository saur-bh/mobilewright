#!/usr/bin/env node
/**
 * Standalone preflight: switches the app to the Staging backend without
 * running the rest of global setup (no reinstall, no sign-in, no PIN). Useful
 * for prepping a device by hand, or for confirming the switch still works on
 * its own when diagnosing a setup failure.
 *
 * Ported from btx-maestro's components/setup/select_server.yaml — see
 * pages/staging-flow.js for the actual switch logic, which utils/global-setup.js
 * also runs automatically before every `npx mobilewright test`.
 *
 * Usage: node scripts/preflight-staging.js
 */
require('dotenv/config');
const { android, loadConfig } = require('mobilewright');
const { OnboardingPage, SignInPage, switchToStaging } = require('../pages');
const { patchDumpRetry } = require('../utils/dump-retry');

async function main() {
    const config = await loadConfig(process.cwd());
    const bundleId = config.bundleId;
    const deviceName = config.deviceName;

    console.log(`[preflight] Launching ${bundleId}...`);
    const device = await android.launch({
        bundleId,
        driver: config.driver,
        deviceName,
        autoAppLaunch: false,
        actionTimeout: config.use?.actionTimeout,
        appLaunchTimeout: config.use?.appLaunchTimeout,
    });

    try {
        // launchApp resumes wherever the app was left, not necessarily Home —
        // terminate first so this always starts from the app's initial screen
        // regardless of where a previous manual session left navigation.
        await device.terminateApp(bundleId).catch(() => {});
        await device.launchApp(bundleId);
        const { screen } = device;
        patchDumpRetry(screen);

        console.log('[preflight] Dismissing onboarding if present...');
        await new OnboardingPage(screen).complete();

        console.log('[preflight] Switching server to Staging...');
        await switchToStaging(screen);

        const onSignIn = await new SignInPage(screen).signInLink.isVisible({ timeout: 15_000 });
        if (!onSignIn) {
            throw new Error('Expected the Sign In screen after switching to Staging, but it never appeared.');
        }

        console.log('[preflight] Done — device is now pointed at Staging.');
    } finally {
        await device.close();
    }
}

main().catch((err) => {
    console.error('[preflight] FAILED:', err.message);
    process.exitCode = 1;
});
