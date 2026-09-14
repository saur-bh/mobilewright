function requireCredentials() {
    if (!process.env.BFX_PROD_FULL_API_KEY || !process.env.BFX_PROD_FULL_API_SECRET) {
        throw new Error('BFX_PROD_FULL_API_KEY and BFX_PROD_FULL_API_SECRET must be set (see .env)');
    }
}

/** @returns {{ publicKey: string, secretKey: string }} */
function getApiCredentials() {
    requireCredentials();
    return {
        publicKey: process.env.BFX_PROD_FULL_API_KEY,
        secretKey: process.env.BFX_PROD_FULL_API_SECRET,
    };
}

module.exports = { requireCredentials, getApiCredentials };
