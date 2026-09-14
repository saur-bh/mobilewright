/**
 * Runtime permissions the onboarding/sign-in flow triggers OS dialogs for.
 * Granting these before the first launch (see utils/global-setup.js) stops
 * the dialogs from appearing at all, instead of racing their animation
 * timing. OnboardingPage/SignInPage still tapIfVisible-guard the same
 * dialogs as a fallback in case a grant doesn't stick on some device.
 */
const RUNTIME_PERMISSIONS = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.CAMERA',
];

module.exports = { RUNTIME_PERMISSIONS };
