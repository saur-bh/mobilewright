const { BasePage } = require('./base-page');

/** The sign-in screen and its "Sign in with API Key" sub-flow. */
class SignInPage extends BasePage {
    get signInLink() {
        return this.screen.getByRole('text', { name: 'Sign in' });
    }

    get apiKeyOption() {
        return this.screen.getByLabel('API Key');
    }

    get locationPermissionButton() {
        return this.screen.getByTestId(
            'com.android.permissioncontroller:id/permission_allow_foreground_only_button',
        );
    }

    get keyTab() {
        return this.screen.getByRole('text', { name: 'Key' });
    }

    get publicKeyField() {
        return this.screen.getByTestId('publicKey');
    }

    get secretKeyField() {
        return this.screen.getByTestId('secretKey');
    }

    get loginButton() {
        return this.screen.getByTestId('Login-Button');
    }

    /** @param {{ publicKey: string, secretKey: string }} credentials */
    async signInWithApiKey(credentials) {
        await this.signInLink.tap();
        await this.apiKeyOption.tap();

        await this.tapIfVisible(this.locationPermissionButton);

        await this.keyTab.tap();
        await this.publicKeyField.fill(credentials.publicKey);
        await this.secretKeyField.fill(credentials.secretKey);
        await this.loginButton.tap();
    }
}

module.exports = { SignInPage };
