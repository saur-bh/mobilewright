const { BasePage } = require('./base-page');

/**
 * The recipient/compliance sub-flow shown after WithdrawAddressPage's
 * requestInvoiceButton — wallet ownership declaration through the
 * Two-Factor Authentication screen.
 *
 * Confirmed against a real run once a fixed keyboard-dismiss bug elsewhere
 * stopped silently no-opping before this screen was ever reached: a ~$5
 * withdrawal DOES trigger this declaration (the consent text's $1,000
 * threshold isn't actually the gate). "I am" is a radio button, not a
 * dropdown — unselected by default; tapping it is what makes the app
 * auto-fill First/Last name below from the account's own KYC data
 * ("Saurabh"/"Verma" for this account — confirmed both empty beforehand and
 * populated right after, on video). Those EditTexts, like
 * MercuryoPage.amountInput elsewhere in this file, report their content as
 * a "text" field, never a "value" field in mobilecli's UI dump, so
 * toHaveValue()/getValue() always read empty regardless of timing; use
 * toBeVisible()/getText() against nameField() instead.
 */
class WithdrawCompliancePage extends BasePage {
    get nonCustodialWalletOption() {
        return this.screen.getByRole('text', { name: 'Non-custodial wallet' });
    }

    /** Unselected by default — tapping it auto-fills the name fields below. */
    get iAmOption() {
        return this.screen.getByLabel('I am');
    }

    /**
     * Matches the pre-filled first/last name EditText by its current text.
     * getByText, not getByRole('textfield', {name}) — these EditTexts carry
     * neither a label nor a testId, and the role+name filter matches an
     * accessible label/name attribute, not raw text content, so it never
     * found them (confirmed live: it read as not visible at all).
     */
    nameField(name) {
        return this.screen.getByText(name);
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
