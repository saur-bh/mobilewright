const { BasePage } = require('./base-page');

/**
 * The "Deposits Support" FAQ bottom sheet, opened from DepositPage.infoButton, and
 * the individual help articles opened from it (e.g. "How to make a deposit").
 *
 * Each article renders inside a WebView, so its content isn't visible to the native
 * accessibility tree on this (non-debuggable) app build — see LiveChatPage.titleText
 * for the same limitation. titleText (the native toolbar title, "Deposits Support")
 * is the closest available proxy that the right screen opened, for both the FAQ list
 * and an individual article.
 */
class DepositSupportPage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'Deposits Support' });
    }

    get closeButton() {
        return this.screen.getByTestId('IconButton-Cross');
    }

    get howToMakeADepositLink() {
        return this.screen.getByLabel('How to make a deposit');
    }
}

module.exports = { DepositSupportPage };
