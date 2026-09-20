const { BasePage } = require('./base-page');

/** The account switcher screen opened from the Home screen's nine-dot menu. */
class AccountMenuPage extends BasePage {
    get backButton() {
        return this.screen.getByTestId('IconButton-ChevronLeft');
    }

    accountName(name) {
        return this.screen.getByRole('text', { name });
    }

    /** The "Account" row inside the nine-dot menu popup. */
    get accountMenuItem() {
        return this.screen.getByText(/Account/);
    }

    /** "Choose server" row on the Account screen. */
    get chooseServerOption() {
        return this.screen.getByText(/Choose server/i);
    }

    /** "Staging" option in the server picker. */
    get stagingOption() {
        return this.screen.getByText(/Staging/);
    }
}

module.exports = { AccountMenuPage };
