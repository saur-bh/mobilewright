const { BasePage } = require('./base-page');

/** The post-login Home screen's "Market Watch" section. */
class WatchlistPage extends BasePage {
    get buildWatchlistPrompt() {
        return this.screen.getByRole('text', { name: 'Build your watchlist' });
    }
}

module.exports = { WatchlistPage };
