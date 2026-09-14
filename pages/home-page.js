const { BasePage } = require('./base-page');

/** The post-login Home screen's top bar (nine-dot menu, live chat) and root content. */
class HomePage extends BasePage {
    get nineDotMenuButton() {
        return this.screen.getByTestId('IconButton-NineDotMenu');
    }

    get liveChatButton() {
        return this.screen.getByTestId('IconButton-LiveChat');
    }

    get myPortfolioText() {
        return this.screen.getByRole('text', { name: 'My Portfolio' });
    }

    get buyCryptoButton() {
        return this.screen.getByRole('text', { name: 'Buy Crypto' });
    }

    get depositButton() {
        return this.screen.getByRole('text', { name: 'Deposit' });
    }

    get withdrawButton() {
        return this.screen.getByRole('text', { name: 'Withdraw' });
    }
}

module.exports = { HomePage };
