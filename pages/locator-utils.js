/** Tap only if present. Short timeout so a missing element costs ~1s. */
async function tapIfVisible(locator, timeout = 1_000) {
    if (await locator.isVisible({ timeout }).catch(() => false)) {
        await locator.tap();
        return true;
    }
    return false;
}

/** Cheapest probe — documented as no-wait. */
async function present(locator) {
    return locator.exists().catch(() => false);
}

module.exports = { tapIfVisible, present };
