const { BasePage } = require('./base-page');

/** The "Deposit <currency>" fee-option bottom sheet, opened by tapping a Cash currency on DepositPage. */
class DepositCurrencyFeesPage extends BasePage {
    /** A payment method row, e.g. "Manual bank transfer, 0.1% Fee (min €60)" or "OpenPayd, €5 Fee". */
    feeOption(label) {
        return this.screen.getByLabel(label);
    }
}

module.exports = { DepositCurrencyFeesPage };
