const { BasePage } = require('./base-page');

/** The bottom tab bar shown on the main authenticated screens. */
class NavigationBarPage extends BasePage {
    get homeTab() {
        return this.screen.getByTestId('Tab-Home');
    }

    get earnTab() {
        return this.screen.getByTestId('Tab-Earn');
    }

    get marketsTab() {
        return this.screen.getByTestId('Tab-Markets');
    }

    get walletTab() {
        return this.screen.getByTestId('Tab-Wallet');
    }
}

module.exports = { NavigationBarPage };
