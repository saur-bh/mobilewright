const { BasePage } = require('./base-page');
const { DEFAULT_PIN } = require('../test-data/pin');

/** The PIN creation ("Create a 4-digit PIN" + confirm) and unlock ("Enter your 4-digit PIN") screens. */
class PinPage extends BasePage {
    get createPinPrompt() {
        return this.screen.getByRole('text', { name: 'Create a 4-digit PIN' });
    }

    get enterPinPrompt() {
        return this.screen.getByRole('text', { name: 'Enter your 4-digit PIN' });
    }

    key(digit) {
        return this.screen.getByRole('text', { name: digit });
    }

    async enter(pin = DEFAULT_PIN) {
        const keys = new Map();
        for (const digit of pin) {
            if (!keys.has(digit)) keys.set(digit, this.key(digit));
            await keys.get(digit).tap();
        }
    }

    /** First entry creates the PIN, second confirms it. */
    async setUp(pin = DEFAULT_PIN) {
        await this.enter(pin);
        await this.enter(pin);
    }
}

module.exports = { PinPage };
