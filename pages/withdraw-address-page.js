const { BasePage } = require('./base-page');

/**
 * The per-asset withdrawal screen reached from WithdrawPage.entry() (e.g.
 * "Withdraw LN-BTC") — invoice/address entry, an optional note, and the
 * compliance checkboxes gating the request-invoice button.
 */
class WithdrawAddressPage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'Withdraw LN-BTC' });
    }

    get invoiceInput() {
        return this.screen.getByTestId('withdrawal_invoice_input');
    }

    get noteInput() {
        return this.screen.getByTestId('withdrawal_note_input');
    }

    /** getByLabel matches the row container, whose bounds start at the tick-box glyph. */
    get termsCheckbox() {
        return this.screen.getByLabel(
            'I have read, understand and agree to the auto-withdrawal processing Terms and Conditions',
        );
    }

    /** Only rendered once the invoice field has content. */
    get travelRuleCheckbox() {
        return this.screen.getByLabel(
            'Send Travel Rule information with this withdrawal. This box must be checked for all withdrawals of $1,000 or more in value. Learn more',
        );
    }

    async checkTerms() {
        await this.tapCheckboxGlyph(this.termsCheckbox);
    }

    async checkTravelRule() {
        await this.tapCheckboxGlyph(this.travelRuleCheckbox);
    }

    /**
     * Taps a checkbox row's tick-box glyph instead of letting `tap()` aim at
     * the row's centre. The glyph isn't its own node in the accessibility
     * tree (only the row container and its text are), and the row's text
     * carries an embedded clickable link span ("Terms and Conditions",
     * "Learn more") that swallows centre taps — those leave the box
     * unchecked, silently and without an error. The glyph sits in the row's
     * top-left corner, which does toggle reliably.
     */
    async tapCheckboxGlyph(checkboxRow) {
        const box = await checkboxRow.boundingBox();
        await this.screen.driver.tap(box.x + 30, box.y + 30);
    }

    get requestInvoiceButton() {
        return this.screen.getByTestId('request_invoice_withdrawal_btn');
    }
}

module.exports = { WithdrawAddressPage };
