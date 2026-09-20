/**
 * Two distinct credential sets, for two distinct purposes — don't merge
 * these back into one "the credentials" accessor:
 *
 *   - Staging: signs into the app's UI. utils/global-setup.js switches the
 *     app to the Staging backend before sign-in (see pages/staging-flow.js),
 *     so this is what the on-device sign-in flow needs.
 *   - Prod: test-data/lightning-invoice.js signs REST calls directly against
 *     Bitfinex's production API (api.bitfinex.com) to generate a real
 *     withdrawal invoice — a separate account, unrelated to which backend
 *     the app UI happens to be pointed at.
 */

function requireStagingCredentials() {
    if (!process.env.BFX_STAGING_API_KEY || !process.env.BFX_STAGING_API_SECRET) {
        throw new Error('BFX_STAGING_API_KEY and BFX_STAGING_API_SECRET must be set (see .env)');
    }
}

/** @returns {{ publicKey: string, secretKey: string }} */
function getStagingApiCredentials() {
    requireStagingCredentials();
    return {
        publicKey: process.env.BFX_STAGING_API_KEY,
        secretKey: process.env.BFX_STAGING_API_SECRET,
    };
}

function requireProdCredentials() {
    if (!process.env.BFX_PROD_FULL_API_KEY || !process.env.BFX_PROD_FULL_API_SECRET) {
        throw new Error('BFX_PROD_FULL_API_KEY and BFX_PROD_FULL_API_SECRET must be set (see .env)');
    }
}

/** @returns {{ publicKey: string, secretKey: string }} */
function getProdApiCredentials() {
    requireProdCredentials();
    return {
        publicKey: process.env.BFX_PROD_FULL_API_KEY,
        secretKey: process.env.BFX_PROD_FULL_API_SECRET,
    };
}

module.exports = {
    requireStagingCredentials,
    getStagingApiCredentials,
    requireProdCredentials,
    getProdApiCredentials,
};
