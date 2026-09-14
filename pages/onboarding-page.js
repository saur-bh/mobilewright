const { BasePage } = require('./base-page');

/** The "Lite or Full" + notifications-permission screen shown after a fresh install. */
class OnboardingPage extends BasePage {
    get notificationsAllowButton() {
        return this.screen.getByTestId('com.android.permissioncontroller:id/permission_allow_button');
    }

    get liteOption() {
        return this.screen.getByRole('text', { name: 'Lite' });
    }

    get continueButton() {
        return this.screen.getByRole('text', { name: 'Continue' });
    }

    /**
     * A fresh install takes noticeably longer than a warm relaunch to raise
     * the OS notifications permission dialog — 1s (tapIfVisible's default)
     * is too short and lets this get skipped, breaking every step after it.
     */
    async complete() {
        await this.tapIfVisible(this.notificationsAllowButton, 8_000);
        await this.tapIfVisible(this.liteOption, 3_000);
        await this.tapIfVisible(this.continueButton, 3_000);
    }
}

module.exports = { OnboardingPage };
