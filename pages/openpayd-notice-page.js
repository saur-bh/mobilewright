const { BasePage } = require('./base-page');

/** The "OpenPayd Notice and Acknowledgement" modal, opened by selecting OpenPayd as a fee option. */
class OpenPaydNoticePage extends BasePage {
    get titleText() {
        return this.screen.getByRole('text', { name: 'OpenPayd Notice and Acknowledgement' });
    }

    get cancelButton() {
        return this.screen.getByLabel('Cancel');
    }
}

module.exports = { OpenPaydNoticePage };
