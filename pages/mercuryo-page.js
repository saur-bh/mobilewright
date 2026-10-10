const { BasePage } = require('./base-page');

/** The Mercuryo buy-crypto deposit screen, opened from BuyCryptoPage.mercuryoRadio. */
class MercuryoPage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'Mercuryo' });
    }

    /**
     * The "Buy" asset selector — tapping it opens the asset-picker bottom
     * sheet. Its label is whatever asset is currently selected (Bitcoin by
     * default), so pass that in rather than hardcoding it.
     */
    assetButton(name = 'Bitcoin') {
        return this.screen.getByRole('text', { name });
    }

    /** An asset row inside the open picker (e.g. "Ethereum"). */
    assetPickerItem(name) {
        return this.screen.getByRole('text', { name });
    }

    /** Closes the asset-picker bottom sheet opened by assetButton() without picking anything. */
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

    /**
     * The deposit address shown for the selected asset — base58 (Bitcoin) or
     * 0x-prefixed hex (Ethereum and other EVM assets); confirmed against a
     * real Ethereum address live, since it's the one used on Staging (see
     * the STAGING branch in the Buy Crypto test: BTC's wallet is under
     * maintenance there, confirmed via the app's own on-screen banner).
     */
    get walletAddressText() {
        return this.screen.getByRole('text', { name: /^(0x[0-9A-Fa-f]{40}|[1-9A-HJ-NP-Za-km-z]{25,64})$/ });
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
