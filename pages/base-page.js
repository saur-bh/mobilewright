const { tapIfVisible } = require('./locator-utils');

/** Shared constructor + locator-probing helpers for every page object. */
class BasePage {
    constructor(screen) {
        this.screen = screen;
    }

    tapIfVisible(locator, timeout) {
        return tapIfVisible(locator, timeout);
    }
}

module.exports = { BasePage };
