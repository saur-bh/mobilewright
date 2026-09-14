const { execSync } = require('node:child_process');
require('dotenv/config');
const { android, loadConfig, expect } = require('mobilewright');
const { OnboardingPage, SignInPage, PinPage, WatchlistPage } = require('../pages');
const { requireCredentials, getApiCredentials } = require('../test-data/credentials');
const { RUNTIME_PERMISSIONS } = require('../test-data/permissions');
const { patchDumpRetry } = require('./dump-retry');

const MAX_ATTEMPTS = 3;

/**
 * Everything below that shells out to `adb` only exists for local
 * emulators. On a cloud provider (Mobile Next) there is no adb serial to
 * resolve and no local shell on the device — uninstall goes through the
 * driver instead, and the runtime permission dialogs fall back to being
 * dismissed in the UI by OnboardingPage/SignInPage.
 */
function isCloudDriver(driver) {
    return !!driver && driver.type !== 'mobilecli';
}

/**
 * adb needs `-s <serial>` once more than one device is attached, but
 * mobilewright's own device identity is the AVD name (matched via
 * `deviceName`), not the adb serial. Resolve one from the other by reading
 * each attached emulator's own AVD name off its `getprop`.
 *
 * `deviceName` is optional (this project's mobilewright.config.js doesn't
 * set one) — with no regex to match against, fall back to the sole attached
 * device and only require disambiguation when more than one is present.
 */
function resolveAdbSerial(deviceNameRegex) {
    const serials = execSync('adb devices', { stdio: 'pipe' })
        .toString()
        .split('\n')
        .slice(1)
        .map((line) => line.split('\t')[0].trim())
        .filter((serial) => serial.length > 0);

    if (!deviceNameRegex) {
        if (serials.length === 1) {
            return serials[0];
        }
        if (serials.length === 0) {
            throw new Error('No attached adb devices found.');
        }
        throw new Error(`Multiple adb devices attached (${serials.join(', ')}) and no deviceName configured in mobilewright.config.js to disambiguate.`);
    }

    const matches = serials.filter((serial) => {
        try {
            const avdName = execSync(`adb -s ${serial} shell getprop ro.boot.qemu.avd_name`, { stdio: 'pipe' })
                .toString()
                .trim();
            // AVD names can't contain spaces (adb/getprop always see underscores),
            // but mobilewright's deviceName matches mobilecli's prettified name
            // (spaces) — normalize before testing so both forms line up.
            return deviceNameRegex.test(avdName.replace(/_/g, ' '));
        } catch {
            return false;
        }
    });

    if (matches.length === 0) {
        throw new Error(`No attached adb device matches deviceName ${deviceNameRegex}. Attached: ${serials.join(', ') || '(none)'}`);
    }
    if (matches.length > 1) {
        throw new Error(`deviceName ${deviceNameRegex} matches more than one attached adb device: ${matches.join(', ')}`);
    }
    return matches[0];
}

function uninstall(bundleId, serial) {
    try {
        execSync(`adb -s ${serial} uninstall ${bundleId}`, { stdio: 'pipe' });
        console.log(`[setup:${serial}] Uninstalled ${bundleId}`);
    } catch {
        console.log(`[setup:${serial}] App not installed, skipping uninstall`);
    }
}

function grantPermissions(bundleId, serial) {
    for (const permission of RUNTIME_PERMISSIONS) {
        try {
            execSync(`adb -s ${serial} shell pm grant ${bundleId} ${permission}`, { stdio: 'pipe' });
        } catch {
            // best-effort — OnboardingPage/SignInPage still handle the dialog if it shows
        }
    }
}

async function signUpAndSetPin(bundleId, config, deviceName) {
    const cloud = isCloudDriver(config.driver);

    const device = await android.launch({
        bundleId,
        driver: config.driver,
        // On cloud the uninstall has to happen over the driver once we're
        // connected, so install after that rather than as part of launch.
        installApps: cloud ? undefined : config.use?.installApps,
        deviceName,
        autoAppLaunch: false,
        actionTimeout: config.use?.actionTimeout,
        appLaunchTimeout: config.use?.appLaunchTimeout,
        installTimeout: config.use?.installTimeout,
    });

    try {
        const serial = cloud ? null : resolveAdbSerial(deviceName);
        const label = serial ?? 'cloud';
        if (cloud) {
            try {
                await device.uninstallApp(bundleId);
                console.log(`[setup:${label}] Uninstalled ${bundleId}`);
            } catch {
                console.log(`[setup:${label}] App not installed, skipping uninstall`);
            }
            for (const appPath of [].concat(config.use?.installApps ?? [])) {
                await device.installApp(appPath);
            }
        } else {
            grantPermissions(bundleId, serial);
        }
        await device.launchApp(bundleId);

        const { screen } = device;
        patchDumpRetry(screen);

        const onboarding = new OnboardingPage(screen);
        const signIn = new SignInPage(screen);
        const pin = new PinPage(screen);
        const watchlist = new WatchlistPage(screen);

        await onboarding.complete();
        await signIn.signInWithApiKey(getApiCredentials());

        await expect(pin.createPinPrompt).toBeVisible({ timeout: 20_000 });
        await pin.setUp();

        await expect(watchlist.buildWatchlistPrompt).toBeVisible({ timeout: 20_000 });

        // Confirm the PIN lock actually re-appears on relaunch, the same way
        // every test in tests/postLogin.spec.js depends on (the `device`
        // fixture relaunches the app before each test).
        await device.close();
        const recheck = await android.launch({ bundleId, driver: config.driver, deviceName, autoAppLaunch: false });
        try {
            await recheck.launchApp(bundleId);
            patchDumpRetry(recheck.screen);
            const pinRecheck = new PinPage(recheck.screen);
            await expect(pinRecheck.enterPinPrompt).toBeVisible({ timeout: 20_000 });
            console.log(`[setup:${label}] Passcode screen confirmed on relaunch`);
        } finally {
            await recheck.close();
        }
    } catch (err) {
        await device.close().catch(() => {});
        throw err;
    }
}

/**
 * Runs once before the suite. Leaves every configured Android device on a
 * fresh install with an account signed in and a PIN set, so
 * `tests/postLogin.spec.js` can start from the PIN-lock screen every test
 * framework relaunch shows afterwards.
 *
 * Retries each device's flow from a clean uninstall on failure, as a
 * fallback in case anything else about that emulator's UI dump timing is
 * flaky. One device's setup failing doesn't block another device's — only
 * devices that ultimately fail after MAX_ATTEMPTS are skipped, so the rest
 * of the suite still runs on whichever devices came up clean.
 *
 * Android-only: uninstall()/grantPermissions() shell out to `adb`, and
 * signUpAndSetPin() uses mobilewright's `android` launcher. There's no iOS
 * equivalent of this setup yet — the `ios` project is commented out in
 * mobilewright.config.js until that's ready.
 */
module.exports = async function globalSetup() {
    requireCredentials();
    const config = await loadConfig(process.cwd());

    // mobilewright.config.js in this repo is hard-configured as a single flat
    // Android target (top-level `platform`/`bundleId`/`deviceName`), not the
    // multi-device `projects` matrix — synthesize one virtual project from it
    // so the rest of this setup (written for the projects shape) still works.
    const androidProjects = config.projects
        ? config.projects.filter((project) => project.use?.platform === 'android')
        : (config.platform === 'android'
            ? [{
                name: 'android',
                use: {
                    ...config.use,
                    platform: config.platform,
                    bundleId: config.bundleId,
                    deviceName: config.deviceName,
                    installApps: config.installApps,
                },
            }]
            : []);

    if (androidProjects.length === 0) {
        throw new Error('No android project found in mobilewright.config.js');
    }

    const failures = [];

    for (const project of androidProjects) {
        const bundleId = project.use.bundleId;
        const deviceName = project.use.deviceName;
        const projectConfig = { ...config, use: { ...config.use, ...project.use } };

        console.log(`[setup] Setting up "${project.name}" (deviceName: ${deviceName ?? '(auto-detect)'})`);

        let succeeded = false;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (!isCloudDriver(config.driver)) {
                uninstall(bundleId, resolveAdbSerial(deviceName));
            }
            try {
                await signUpAndSetPin(bundleId, projectConfig, deviceName);
                console.log(`[setup] "${project.name}" ready — account created and signed in`);
                succeeded = true;
                break;
            } catch (err) {
                console.log(`[setup] "${project.name}" attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
            }
        }

        if (!succeeded) {
            failures.push(project.name);
        }
    }

    if (failures.length === androidProjects.length) {
        throw new Error(`Setup failed on every device: ${failures.join(', ')}`);
    }
    if (failures.length > 0) {
        console.log(`[setup] WARNING: setup failed on ${failures.join(', ')} — their tests will fail; other devices are ready`);
    }
};
