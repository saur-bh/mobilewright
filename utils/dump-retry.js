/**
 * uiautomator dump can fail transiently ("no XML content found") during a
 * screen transition, or hang/fail outright if a previous dump attempt was
 * killed mid-flight and left its instrumentation process holding the
 * device's exclusive UiAutomation connection. The framework's own locator
 * polling (isVisible/tap/expect) doesn't retry a raw dump failure, only a
 * "not found yet" state, so one bad dump call aborts an otherwise-successful
 * multi-second wait.
 *
 * Patches the screen's underlying driver so every dump call gets a few quick
 * retries transparently — fixes every locator operation on this screen, not
 * just the one call site that happened to trip over it. Safe to call more
 * than once; only patches each driver instance the first time.
 */
function patchDumpRetry(screen, attempts = 5, delayMs = 500) {
    const driver = screen.driver;
    if (!driver || typeof driver.getViewHierarchy !== 'function' || driver.__dumpRetryPatched) {
        return;
    }
    const original = driver.getViewHierarchy.bind(driver);
    driver.getViewHierarchy = async () => {
        let lastErr;
        for (let i = 0; i < attempts; i++) {
            try {
                return await original();
            } catch (err) {
                lastErr = err;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
        throw lastErr;
    };
    driver.__dumpRetryPatched = true;
}

module.exports = { patchDumpRetry };
