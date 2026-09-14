const { BasePage } = require('./base-page');

/** The "Recent deposits" history screen, opened from DepositPage.historyButton. */
class RecentDepositsPage extends BasePage {
    get searchField() {
        return this.screen.getByRole('textfield');
    }

    get backButton() {
        return this.screen.getByTestId('IconButton-ChevronLeft');
    }

    /** A deposit row, e.g. "Bitcoin (Lightning Network), Completed, 0.00006491 LN-BTC, Exchange, 26-05-19". */
    entry(label) {
        return this.screen.getByLabel(label);
    }
}

module.exports = { RecentDepositsPage };
