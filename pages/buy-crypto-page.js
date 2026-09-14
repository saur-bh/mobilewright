const { BasePage } = require('./base-page');

/**
 * The "Buy Crypto" credit/debit card provider list. Same underlying screen
 * whether reached from HomePage.buyCryptoButton or DepositPage.buyCryptoTab
 * (identical testIds/content either way) — only the back navigation differs
 * by entry point.
 */
class BuyCryptoPage extends BasePage {
    get creditDebitCardHeading() {
        return this.screen.getByRole('text', { name: 'Credit/debit card' });
    }

    get mercuryoRadio() {
        return this.screen.getByTestId('payment_deposit_mercuryo_radio');
    }

    get simplexRadio() {
        return this.screen.getByTestId('payment_deposit_simplex_radio');
    }

    get backButton() {
        return this.screen.getByTestId('IconButton-ChevronLeft');
    }
}

module.exports = { BuyCryptoPage };
