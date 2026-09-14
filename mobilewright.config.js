const { defineConfig } = require('mobilewright');
require('dotenv/config');

// Run against Mobile Next Cloud real devices instead of a local emulator:
//   MW_CLOUD=1 npx mobilewright test
// Without the flag the suite keeps running locally over mobilecli/adb.
// https://mobilewright.dev/docs/cloud-providers/mobile-next-cloud
const useCloud = process.env.MW_CLOUD === '1';

if (useCloud && !process.env.MOBILENEXT_API_KEY) {
  throw new Error('MW_CLOUD=1 but MOBILENEXT_API_KEY is not set in .env');
}

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: './utils/global-setup.js',

  platform: 'android',
  bundleId: 'com.bitfinex.mobileapp.dev',
  installApps: './app/android/newapp.apk',

  // Cloud devices are allocated from Mobile Next's pool; omitting `driver`
  // falls back to the default local mobilecli driver.
  ...(useCloud && {
    driver: {
      type: 'mobilenext',
      apiKey: process.env.MOBILENEXT_API_KEY,
      // Waiting for a free device in the pool. Default 300_000.
      allocationTimeout: 600_000,
      // Off by default: this ships the run's results *and* git commit metadata
      // to mobilenext.ai. Flip uploadReport to 'on' (or 'on-failure') if you
      // want the hosted report.
      testResult: { uploadReport: 'off' },
    },
  }),

  reporter: 'list',
  workers: 1,
  timeout: 90_000,

  use: {
    actionTimeout: 5_000,      // was 30_000 — your main bottleneck
    appLaunchTimeout: 20_000,
    // The APK is ~300 MB; on cloud it has to be uploaded, not just pushed.
    installTimeout: useCloud ? 900_000 : 180_000,
    animations: 'off',
  },

  expect: { timeout: 5_000 },
  viewTree: 'on-failure',
});
