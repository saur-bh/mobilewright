const { BasePage } = require('./base-page');

/** The account switcher screen opened from the Home screen's nine-dot menu. */
class AccountMenuPage extends BasePage {
    get backButton() {
        return this.screen.getByTestId('IconButton-ChevronLeft');
    }

    accountName(name) {
        return this.screen.getByRole('text', { name });
    }
}

module.exports = { AccountMenuPage };
