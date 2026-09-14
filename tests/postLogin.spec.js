const { test, expect } = require('@mobilewright/test');
const {
    PinPage,
    WatchlistPage,
    NavigationBarPage,
    ensureSignedIn,
    HomePage,
    AccountMenuPage,
    LiveChatPage,
    BuyCryptoPage,
    MercuryoPage,
    MercuryoTosPage,
    DepositPage,
    DepositSupportPage,
    RecentDepositsPage,
    DepositCurrencyFeesPage,
    OpenPaydNoticePage,
    WithdrawPage,
    WithdrawAddressPage,
    WithdrawCompliancePage,
    present,
    tapIfVisible,
} = require('../pages');
const { patchDumpRetry } = require('../utils/dump-retry');
const { generateLightningWithdrawalInvoice } = require('../test-data/lightning-invoice');

test.use({ video: 'retain-on-failure' });

test.describe('Authenticated session', () => {

    // Main test — unlocks the app and verifies the watchlist screen actually opens.
    test('Post-login: watchlist screen opens', async ({ screen }) => {
        patchDumpRetry(screen);

        const pin = new PinPage(screen);
        const watchlist = new WatchlistPage(screen);

        await expect(pin.enterPinPrompt).toBeVisible({ timeout: 20_000 });
        await pin.enter();

        await expect(watchlist.buildWatchlistPrompt).toBeVisible({ timeout: 20_000 });
    });

    test('Post-login: bottom navigation bar shows all tabs', async ({ screen }) => {
        patchDumpRetry(screen);

        const pin = new PinPage(screen);
        const nav = new NavigationBarPage(screen);

        await expect(pin.enterPinPrompt).toBeVisible({ timeout: 20_000 });
        await pin.enter();

        await expect(nav.homeTab).toBeVisible({ timeout: 20_000 });
        await expect(nav.earnTab).toBeVisible();
        await expect(nav.marketsTab).toBeVisible();
        await expect(nav.walletTab).toBeVisible();
    });

    test('Home: nine-dot menu, live chat, and back to home', async ({ screen }) => {
        patchDumpRetry(screen);
        await ensureSignedIn(screen);

        const home = new HomePage(screen);
        const accountMenu = new AccountMenuPage(screen);
        const liveChat = new LiveChatPage(screen);

        // Step 1: open the nine-dot menu
        await home.nineDotMenuButton.tap();

        // Step 2: verify the signed-in account is shown
        await expect(accountMenu.accountName('saurabh-verma-auto2')).toBeVisible();

        // Step 3: go back
        await accountMenu.backButton.tap();

        // Step 4: open live chat
        await home.liveChatButton.tap();

        // Step 5: verify the live chat webview opened. The "Bitfinex Customer
        // Support" text itself lives inside the webview and can't be asserted
        // on this (non-debuggable) app build — see the comment on
        // LiveChatPage.titleText for why. This checks the native toolbar
        // title as the closest available proxy.
        await expect(liveChat.titleText).toBeVisible({ timeout: 20_000 });

        // Step 6: close live chat
        await liveChat.closeButton.tap();

        // Step 7: verify we're back on the home screen
        await expect(home.myPortfolioText).toBeVisible();
    });

    test('Buy Crypto: Mercuryo asset limits, address refresh, and TOS notice', async ({ screen }) => {
        patchDumpRetry(screen);
        await ensureSignedIn(screen);

        const home = new HomePage(screen);
        const buyCrypto = new BuyCryptoPage(screen);
        const mercuryo = new MercuryoPage(screen);
        const tos = new MercuryoTosPage(screen);

        // Step 1: open Buy Crypto
        await home.buyCryptoButton.tap();

        // Step 2-3: both card providers are offered
        await expect(buyCrypto.mercuryoRadio).toBeVisible();
        await expect(buyCrypto.simplexRadio).toBeVisible();

        // Step 4: choose Mercuryo
        await buyCrypto.mercuryoRadio.tap();
        await expect(mercuryo.titleText).toBeVisible();

        // Step 5-6: open the asset picker on the default Bitcoin selection, then dismiss it
        await mercuryo.buyAssetButton.tap();
        await mercuryo.assetPickerCloseButton.tap();
        await expect(mercuryo.titleText).toBeVisible();

        // Step 7: record the min/max range shown for the selected asset
        const rangeText = await mercuryo.minMaxRangeText.getText();
        const [, minAmount, maxAmount] = rangeText.match(/Min ([\d.]+) - Max ([\d.]+)/);

        // Step 8-9: MIN fills the amount field with the recorded minimum. Uses
        // toHaveText, not toHaveValue: mobilecli's UI dump reports this EditText's
        // content as a "text" field, never a "value" field (confirmed via a raw
        // `mobilecli dump ui` — no node in this app ever carries "value"), so
        // getValue()/toHaveValue() reads as permanently empty regardless of timing.
        await mercuryo.minButton.tap();
        await expect(mercuryo.amountInput).toHaveText(minAmount);

        // Step 10-11: MAX fills the amount field with the recorded maximum
        await mercuryo.maxButton.tap();
        await expect(mercuryo.amountInput).toHaveText(maxAmount);

        // Step 12-14: a valid deposit address is shown. The address reload this
        // step originally drove is not exercised — asserting the address changes
        // was flaky (the backend can legitimately reissue the same one), and
        // reloading without asserting the result tested nothing.
        await expect(mercuryo.walletAddressText).toBeVisible();

        // Step 15-16: open the Mercuryo third-party notice and verify the privacy-policy link
        await mercuryo.noticeButton.tap();
        await expect(tos.privacyPolicyLink).toBeVisible();

        // Step 17-18: close the notice, back on the Mercuryo screen
        await tos.closeButton.tap();
        await expect(mercuryo.titleText).toBeVisible();

        // Step 19-20: navigate back twice (Mercuryo -> Buy Crypto -> Home)
        await mercuryo.backButton.tap();
        await buyCrypto.backButton.tap();

        // Step 21: back on the home screen
        await expect(home.myPortfolioText).toBeVisible();
    });

    test('Deposit: crypto search, support article, history, cash fees, and OpenPayd notice', async ({ screen }) => {
        // Longer than the 45s default — this flow crosses many more screens than the
        // other tests here, including a WebView-backed support article.
        test.setTimeout(90_000);

        patchDumpRetry(screen);
        await ensureSignedIn(screen);

        const home = new HomePage(screen);
        const deposit = new DepositPage(screen);
        const support = new DepositSupportPage(screen);
        const recentDeposits = new RecentDepositsPage(screen);
        const currencyFees = new DepositCurrencyFeesPage(screen);
        const openPaydNotice = new OpenPaydNoticePage(screen);
        const buyCrypto = new BuyCryptoPage(screen);

        // Step 1: open Deposit
        await home.depositButton.tap();

        // Step 2: Crypto tab (already the default, tapped anyway as specified)
        await deposit.cryptoTab.tap();

        // Step 3-4: search narrows the list to the Lightning Network entry only
        await deposit.searchField.fill('light');
        await expect(deposit.entry('Bitcoin (Lightning Network), LN-BTC')).toBeVisible();

        // Step 5-6: clearing search restores the full list
        await deposit.searchClearButton.tap();
        await expect(deposit.entry('Bitcoin, BTC')).toBeVisible();

        // Step 7-8: open the Deposits Support FAQ
        await deposit.infoButton.tap();
        await expect(support.titleText).toBeVisible();

        // Step 9-10: open the "How to make a deposit" article. Its content renders in
        // a WebView invisible to this (non-debuggable) build's accessibility tree —
        // see DepositSupportPage.titleText — so this re-checks the same native
        // toolbar title as the closest available proxy that the article opened.
        await support.howToMakeADepositLink.tap();
        await expect(support.titleText).toBeVisible();

        // Step 11: close the article, back on the FAQ list
        await support.closeButton.tap();

        // Step 12: close the FAQ list, back on the Deposit screen
        await support.closeButton.tap();

        // Step 13-14: open deposit history and search it
        await deposit.historyButton.tap();
        await recentDeposits.searchField.fill('light');

        // Step 15: the matching historical deposit is shown
        await expect(
            recentDeposits.entry('Bitcoin (Lightning Network), Completed, 0.00006491 LN-BTC, Exchange, 26-05-19'),
        ).toBeVisible();

        // Step 16-17: back on the Deposit screen
        await recentDeposits.backButton.tap();
        await expect(deposit.titleText).toBeVisible();

        // Step 18-19: Cash tab lists the supported fiat currencies
        await deposit.cashTab.tap();
        await expect(deposit.entry('USD, US Dollar')).toBeVisible();
        await expect(deposit.entry('EUR, Euro')).toBeVisible();
        await expect(screen.getByRole('text', { name: 'Pound Sterling' })).toBeVisible();

        // Step 20: selecting EUR opens its fee options directly as a bottom sheet —
        // the manual case's chevron-back tap here was checked live and it dismisses
        // this sheet instead of revealing the fee options, so it's omitted; picking
        // EUR is what actually surfaces the assertions below.
        await deposit.entry('EUR, Euro').tap();

        // Step 21-22 (see note above): both fee options are shown
        await expect(currencyFees.feeOption('Manual bank transfer, 0.1% Fee (min €60)')).toBeVisible();
        await expect(currencyFees.feeOption('OpenPayd, €5 Fee')).toBeVisible();

        // Step 23: choosing OpenPayd shows its third-party notice
        await currencyFees.feeOption('OpenPayd, €5 Fee').tap();
        await expect(openPaydNotice.titleText).toBeVisible();

        // Step 24: cancel out of the notice
        await openPaydNotice.cancelButton.tap();

        // Step 25-26: Buy Crypto tab shows the same credit/debit card providers as
        // HomePage.buyCryptoButton's flow (see BuyCryptoPage's class comment)
        await deposit.buyCryptoTab.tap();
        await expect(buyCrypto.creditDebitCardHeading).toBeVisible();

        // Step 27-28: back to the home screen
        await deposit.backButton.tap();
        await expect(home.myPortfolioText).toBeVisible();
    });

    test('Withdraw: LN-BTC invoice request through 2FA', async ({ screen, device, bundleId }) => {
        // Longer than the 45s default — includes a live call to Bitfinex's
        // production API to generate the withdrawal invoice (step 11).
        test.setTimeout(90_000);

        patchDumpRetry(screen);
        await ensureSignedIn(screen);

        const nav = new NavigationBarPage(screen);
        const home = new HomePage(screen);
        const withdraw = new WithdrawPage(screen);
        const withdrawAddress = new WithdrawAddressPage(screen);
        const compliance = new WithdrawCompliancePage(screen);

        // Step 2: open the Home tab
        await nav.homeTab.tap();

        // Step 3-4: open Withdraw
        await home.withdrawButton.tap();
        await expect(withdraw.titleText).toBeVisible();

        // Step 5-8: Crypto tab (default), search narrows the list to the
        // Lightning Network entry
        await withdraw.cryptoTab.tap();
        await expect(withdraw.searchField).toBeVisible();
        await withdraw.searchField.fill('light');

        // Step 9-10: open the LN-BTC withdrawal screen. Retries once — the
        // search above leaves the keyboard closing, and a tap dispatched
        // mid-reflow lands on nothing: no error, no navigation.
        await withdraw.entry('Bitcoin (Lightning Network)').tap();
        if (!(await present(withdrawAddress.titleText))) {
            await withdraw.entry('Bitcoin (Lightning Network)').tap();
        }
        await expect(withdrawAddress.titleText).toBeVisible();

        // Step 13, moved ahead of the form fields: accept the T&Cs while the
        // screen is still keyboard-free. A tap fired just after the keyboard
        // closes gets swallowed mid-reflow, which left this box silently
        // unchecked every run while it sat after the note field.
        await withdrawAddress.checkTerms();

        // Step 11: fill the invoice field with a real Lightning invoice —
        // the app validates the invoice client-side and rejects a fabricated
        // one, so this requires a genuine invoice from Bitfinex's production
        // API (see test-data/lightning-invoice.js; no funds are moved by
        // generating it, only requested as a receiving invoice)
        const invoice = await generateLightningWithdrawalInvoice();
        await withdrawAddress.invoiceInput.fill(invoice);

        // Step 12: internal note
        await withdrawAddress.noteInput.fill('Automation test');

        // Dismiss the note field's keyboard before the checkbox below — it
        // covers it, and its closing animation reflows the row's position.
        // Tapping the (non-interactive) screen title blurs the field without
        // risking the real back-navigation a hardware BACK press causes once
        // the keyboard has already closed on its own.
        await withdrawAddress.titleText.tap();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 14: Travel Rule consent — only rendered once the invoice field
        // has content, so unlike the T&Cs above it can't be done up front
        await withdrawAddress.checkTravelRule();

        // Step 15: request the withdrawal invoice once the button is enabled
        await expect(withdrawAddress.requestInvoiceButton).toBeEnabled({ timeout: 20_000 });
        await withdrawAddress.requestInvoiceButton.tap();

        // Step 16-19: the Travel Rule recipient declaration (non-custodial
        // wallet -> "I am" -> recipient name -> Continue). The app only asks
        // for it above a value threshold — the consent text names $1,000,
        // and this withdrawal is ~$5, so it goes straight to 2FA instead.
        // Probed rather than asserted so the flow works either way.
        if (await tapIfVisible(compliance.nonCustodialWalletOption)) {
            await compliance.iAmDropdown.tap();
            await expect(compliance.nameField('Saurabh')).toHaveValue('saurabh');
            await compliance.continueButton.tap();
        }

        // Step 20: 2FA is the last screen before the withdrawal is submitted
        await expect(compliance.twoFactorAuthText).toBeVisible({ timeout: 20_000 });

        // Step 21: back out rather than completing the withdrawal — this
        // test only verifies the flow reaches 2FA, it never confirms
        await compliance.backButton.tap();

        // Step 22: terminate the app
        await device.terminateApp(bundleId);
    });

});
