const fs = require('fs');
const path = require('path');
const { defineConfig } = require('mobilewright');
const { browserStackDriver } = require('@browserstack/mobilewright');
require('dotenv/config');

// Helper to resolve the actual APK path
function getApkPath(relativeDir) {
  const dir = path.resolve(process.cwd(), relativeDir);
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = fs.readdirSync(dir);
  const apk = files.find(file => /\.apk$/i.test(file));

  if (!apk) {
    throw new Error(`No .apk file found in ${dir}`);
  }

  return path.join(dir, apk);
}

// Run against Mobile Next Cloud real devices instead of a local emulator:
//   MW_CLOUD=1 npx mobilewright test
const useCloud = process.env.MW_CLOUD === '1';

// Run against BrowserStack App Automate real devices:
//   BROWSERSTACK=1 npx mobilewright test
//
// Deliberately an explicit opt-in flag rather than auto-detecting
// BROWSERSTACK_USERNAME: .env already defines the BrowserStack vars and is
// loaded above, so keying off credential presence would silently redirect
// every ordinary local run onto paid cloud devices.
const useBrowserStack = process.env.BROWSERSTACK === '1';

if (useBrowserStack && useCloud) {
  throw new Error('BROWSERSTACK=1 and MW_CLOUD=1 are mutually exclusive — pick one cloud provider.');
}

if (useCloud && !process.env.MOBILENEXT_API_KEY) {
  throw new Error('MW_CLOUD=1 but MOBILENEXT_API_KEY is not set in .env');
}

if (useBrowserStack) {
  const missing = ['BROWSERSTACK_USERNAME', 'BROWSERSTACK_ACCESS_KEY'].filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`BROWSERSTACK=1 but ${missing.join(' and ')} not set in .env`);
  }
}

// Prefer an already-uploaded bs://<app-id> (BROWSERSTACK_APP) over the local
// APK — the APK here is ~290MB, so re-uploading it on every run is slow.
// Falls back to the local file, which the driver uploads once per run.
const browserStackApp = process.env.BROWSERSTACK_APP || getApkPath('./app/android');

// Device selection on BrowserStack. deviceName is matched as a regex.
const bsDeviceName = process.env.BROWSERSTACK_DEVICE || 'Google Pixel 8';
const bsOsVersion = process.env.BROWSERSTACK_OS_VERSION;

/**
 * Builds the BrowserStack driver, with a workaround for a round-trip bug in
 * @browserstack/mobilewright@0.1.1.
 *
 * The driver's listDevices() reports `id` as `${device}-${os_version}`
 * ("Google Pixel 8 Pro-14.0") while `name` stays bare ("Google Pixel 8 Pro").
 * mobilewright's standalone launch path (launchers.js findDevice) matches the
 * configured deviceName regex against `name`, then connects using `id` — and
 * connect() feeds that id straight back in as a *device-name pattern*, which is
 * only ever tested against the bare `device` field. The composite can never
 * match a bare name, so every device fails with "No android device matches
 * name /<device>-<version>/", whatever you configure.
 *
 * utils/global-setup.js uses exactly that standalone path (android.launch), so
 * without this the suite can't get past setup. Reporting the bare name as the
 * id closes the loop. Tests themselves are unaffected either way — they go
 * through the device pool, which allocates first and attaches by session id.
 */
function makeBrowserStackDriver() {
  const driver = browserStackDriver({
    app: browserStackApp,
    project: 'btx-mw-prod',
    build: process.env.BROWSERSTACK_BUILD || `local-${new Date().toISOString().slice(0, 10)}`,
    allocationTimeout: 600_000,
  });

  const listDevices = driver.listDevices.bind(driver);
  driver.listDevices = async opts =>
    (await listDevices(opts)).map(device => ({ ...device, id: device.name }));

  return driver;
}

const BUNDLE_ID = 'com.bitfinex.mobileapp.dev';

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: './utils/global-setup.js',

  platform: 'android',
  bundleId: BUNDLE_ID,
  // Resolved dynamically so Mobilewright receives a valid filepath.
  // On BrowserStack the app comes from the driver's `app` option instead.
  ...(!useBrowserStack && { installApps: [getApkPath('./app/android')] }),

  ...(useCloud && {
    driver: {
      type: 'mobilenext',
      apiKey: process.env.MOBILENEXT_API_KEY,
      allocationTimeout: 600_000,
      testResult: { uploadReport: 'off' },
    },
  }),

  ...(useBrowserStack && {
    driver: makeBrowserStackDriver(),
    projects: [
      {
        name: 'android',
        use: {
          platform: 'android',
          // utils/global-setup.js reads bundleId straight off project.use when
          // `projects` is set (it only synthesizes one from the top-level keys
          // when there are none), so it has to be repeated here — without it
          // setup calls activateApp/removeApp with an undefined appId.
          bundleId: BUNDLE_ID,
          deviceType: 'real',
          deviceName: new RegExp(bsDeviceName),
          ...(bsOsVersion && { osVersion: bsOsVersion }),
        },
      },
    ],
  }),

  reporter: 'list',
  workers: 1,
  timeout: 90_000,

  use: {
    actionTimeout: 5_000,
    appLaunchTimeout: 20_000,
    installTimeout: useCloud || useBrowserStack ? 900_000 : 180_000,
    animations: 'off',
  },

  expect: { timeout: 5_000 },
  viewTree: 'on-failure',
});
