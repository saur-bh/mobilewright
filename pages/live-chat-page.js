const { BasePage } = require('./base-page');

/** The "Live chat" webview modal opened from the Home screen. */
class LiveChatPage extends BasePage {
    get closeButton() {
        return this.screen.getByTestId('IconButton-Cross');
    }

    /**
     * Native toolbar title — confirms the Live Chat screen itself opened.
     * The chat widget's own content ("Bitfinex Customer Support", the message
     * list, etc.) renders inside an embedded webview that this app build
     * doesn't expose: screen.getByWebView().page() needs the app built with
     * android:debuggable="true" (mobilewright.dev/docs/guides/webviews), and
     * a live dump of this screen (see git history / PR discussion) shows the
     * webview contributes no node at all to the native accessibility tree —
     * not even as an opaque webview container — so there's no native locator
     * that can reach that text either. Asserting this title is the closest
     * available proxy for "the chat opened" until a debuggable build is
     * available for automation.
     */
    get titleText() {
        return this.screen.getByRole('text', { name: 'Live chat' });
    }
}

module.exports = { LiveChatPage };
