const { BasePage } = require('./base-page');

/** The Mercuryo buy-crypto deposit screen, opened from BuyCryptoPage.mercuryoRadio. */
class MercuryoPage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'Mercuryo' });
    }

    /** The "Buy" asset selector — tapping it opens the asset-picker bottom sheet. */
    get buyAssetButton() {
        return this.screen.getByRole('text', { name: 'Bitcoin' });
    }

    /** Closes the asset-picker bottom sheet opened by buyAssetButton. */
    get assetPickerCloseButton() {
        return this.screen.getByTestId('IconButton-Cross');
    }

    get minButton() {
        return this.screen.getByRole('text', { name: 'MIN' });
    }

    get maxButton() {
        return this.screen.getByRole('text', { name: 'MAX' });
    }

    get amountInput() {
        return this.screen.getByTestId('withdrawal_crypto_amount');
    }

    /** "Min X - Max Y" range label for the selected asset; values are per-session. */
    get minMaxRangeText() {
        return this.screen.getByRole('text', { name: /^Min [\d.]+ - Max [\d.]+/ });
    }

    /** The base58 deposit address shown for the selected asset. */
    get walletAddressText() {
        return this.screen.getByRole('text', { name: /^[1-9A-HJ-NP-Za-km-z]{25,64}$/ });
    }

    /** Opens the MercuryoTosPage notice modal. */
    get noticeButton() {
        return this.screen.getByRole('button', { name: 'notice' });
    }

    get backButton() {
        return this.screen.getByTestId('IconButton-ChevronLeft');
    }
}

module.exports = { MercuryoPage };
