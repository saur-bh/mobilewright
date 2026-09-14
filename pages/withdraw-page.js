const { BasePage } = require('./base-page');

/** The Withdraw Funds screen — Crypto/Cash tabs and asset search, entry point for withdrawal flows. */
class WithdrawPage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'Withdraw Funds' });
    }

    get cryptoTab() {
        return this.screen.getByRole('text', { name: 'Crypto' });
    }

    get searchField() {
        return this.screen.getByRole('textfield');
    }

    /**
     * An asset row's name label, e.g. "Bitcoin (Lightning Network)". Matched
     * on the name alone rather than the row's full composite label — the
     * withdraw list also renders live balance/USD value in that label, which
     * drifts with price and account balance and would make an exact-label
     * match flaky.
     */
    entry(name) {
        return this.screen.getByRole('text', { name });
    }
}

module.exports = { WithdrawPage };
