const { BasePage } = require('./base-page');

/** The "mercuryo TOS" notice modal, opened via MercuryoPage.noticeButton. */
class MercuryoTosPage extends BasePage {
    get privacyPolicyLink() {
        return this.screen.getByLabel('MoneySwap’s privacy policy');
    }

    get closeButton() {
        return this.screen.getByRole('text', { name: 'Close' });
    }
}

module.exports = { MercuryoTosPage };
