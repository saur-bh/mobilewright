const { BasePage } = require('./base-page');

/** The Deposit screen — Crypto/Cash/Buy Crypto tabs, asset search, info and history entry points. */
class DepositPage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'Deposit' });
    }

    get backButton() {
        return this.screen.getByTestId('IconButton-ChevronLeft');
    }

    get infoButton() {
        return this.screen.getByTestId('IconButton-Info');
    }

    get historyButton() {
        return this.screen.getByTestId('IconButton-History');
    }

    get cryptoTab() {
        return this.screen.getByRole('text', { name: 'Crypto' });
    }

    get cashTab() {
        return this.screen.getByRole('text', { name: 'Cash' });
    }

    get buyCryptoTab() {
        return this.screen.getByRole('text', { name: 'Buy Crypto' });
    }

    get searchField() {
        return this.screen.getByRole('textfield');
    }

    get searchClearButton() {
        return this.screen.getByTestId('IconButton-Cross');
    }

    /** An asset (Crypto tab) or currency (Cash tab) row, e.g. "Bitcoin, BTC" or "EUR, Euro". */
    entry(label) {
        return this.screen.getByLabel(label);
    }
}

module.exports = { DepositPage };
