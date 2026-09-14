const { BasePage } = require('./base-page');

/**
 * The recipient/compliance sub-flow shown after WithdrawAddressPage's
 * requestInvoiceButton — wallet ownership declaration through the
 * Two-Factor Authentication screen.
 *
 * twoFactorAuthText and backButton are confirmed against the app.
 * The four recipient-declaration locators above them are as specified in
 * the manual case and unconfirmed: a ~$5 withdrawal skips that step
 * entirely (the consent text names a $1,000 threshold), so the test probes
 * for it rather than requiring it. Re-check them with
 * `npx mobilewright inspect` if a withdrawal large enough to trigger the
 * declaration ever needs covering.
 */
class WithdrawCompliancePage extends BasePage {
    get nonCustodialWalletOption() {
        return this.screen.getByRole('text', { name: 'Non-custodial wallet' });
    }

    get iAmDropdown() {
        return this.screen.getByLabel('I am');
    }

    nameField(name) {
        return this.screen.getByRole('textfield', { name });
    }

    get continueButton() {
        return this.screen.getByLabel('Continue');
    }

    get twoFactorAuthText() {
        return this.screen.getByRole('text', { name: 'Two-Factor Authentication' });
    }

    get backButton() {
        return this.screen.getByLabel('Back');
    }
}

module.exports = { WithdrawCompliancePage };
