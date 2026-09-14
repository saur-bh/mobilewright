const crypto = require('node:crypto');
const { getApiCredentials } = require('./credentials');

const USD_AMOUNT = 5;
const MIN_BTC_AMOUNT = 0.000001;
const MAX_BTC_AMOUNT = 0.02;

let lastNonce = 0;

/** Bitfinex requires each authenticated request's nonce to strictly increase. */
function nextNonce() {
    const nonce = Math.max(Date.now() * 1000, lastNonce + 1);
    lastNonce = nonce;
    return nonce.toString();
}

function signedHeaders(apiPath, body, credentials) {
    const nonce = nextNonce();
    const signaturePayload = `/api/${apiPath}${nonce}${body}`;
    const signature = crypto.createHmac('sha384', credentials.secretKey).update(signaturePayload).digest('hex');
    return {
        'Content-Type': 'application/json',
        'bfx-apikey': credentials.publicKey,
        'bfx-nonce': nonce,
        'bfx-signature': signature,
    };
}

async function postAuth(apiPath, payload, credentials) {
    const body = JSON.stringify(payload);
    const response = await fetch(`https://api.bitfinex.com/${apiPath}`, {
        method: 'POST',
        headers: signedHeaders(apiPath, body, credentials),
        body,
    });
    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch {
        result = text;
    }
    if (!response.ok) {
        throw new Error(`${apiPath} failed: ${response.status} ${JSON.stringify(result)}`);
    }
    return result;
}

async function getBtcUsdPrice() {
    const response = await fetch('https://api-pub.bitfinex.com/v2/ticker/tBTCUSD');
    if (!response.ok) {
        throw new Error(`Failed to get BTC/USD price: ${response.status} ${await response.text()}`);
    }
    const ticker = await response.json();
    const price = Number(ticker[6]); // LAST_PRICE
    if (!price || Number.isNaN(price)) {
        throw new Error(`Invalid BTC/USD price returned: ${JSON.stringify(ticker)}`);
    }
    return price;
}

/**
 * Generates a real Bitfinex Lightning Network invoice worth ~$5 of BTC, to
 * use as the withdrawal destination address in the withdrawal test (the app
 * validates the invoice client-side and won't accept a fabricated one — see
 * WithdrawAddressPage). Signs authenticated requests against Bitfinex's
 * production REST API with the same BFX_PROD_FULL_API_KEY/SECRET credentials
 * global-setup.js signs in with (see credentials.js). This only requests a
 * receiving invoice — no funds are moved by this call.
 *
 * Initializes Lightning on the exchange wallet first (POST
 * /v2/auth/w/deposit/address, method LNX): invoice creation fails on an
 * account that has never generated a Lightning deposit before, and Bitfinex
 * documents this init call as safe to repeat once already set up.
 */
async function generateLightningWithdrawalInvoice() {
    const credentials = getApiCredentials();

    await postAuth('v2/auth/w/deposit/address', { wallet: 'exchange', method: 'LNX' }, credentials);

    const btcUsdPrice = await getBtcUsdPrice();
    const btcAmount = USD_AMOUNT / btcUsdPrice;
    if (btcAmount < MIN_BTC_AMOUNT || btcAmount > MAX_BTC_AMOUNT) {
        throw new Error(`$${USD_AMOUNT} converts to ${btcAmount} BTC, outside the invoice range ${MIN_BTC_AMOUNT}-${MAX_BTC_AMOUNT} BTC`);
    }

    const result = await postAuth('v2/auth/w/deposit/invoice', {
        wallet: 'exchange',
        currency: 'LNX',
        amount: btcAmount.toFixed(8),
    }, credentials);

    const invoice = result?.[1];
    if (!invoice) {
        throw new Error(`No invoice in Bitfinex response: ${JSON.stringify(result)}`);
    }
    return invoice;
}

module.exports = { generateLightningWithdrawalInvoice };
