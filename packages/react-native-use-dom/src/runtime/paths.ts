/**
 * The URLs both halves of the library agree on. The native side builds them, the bundler
 * integration serves them; keeping them in one module is what stops the two from drifting.
 */

/**
 * The origin release builds serve DOM components from.
 *
 * A real origin rather than `file://`, so that `localStorage`, `fetch` and module scripts behave the
 * way they do on the web. Nothing is fetched over the network: the native side answers every request
 * from the app bundle.
 */
export const OFFLINE_ORIGIN = 'https://use-dom.localhost';

/** The path the development middleware is mounted at on the React Native dev server. */
export const DEV_MOUNT_PATH = '_dom';

/** The page the WebView loads in development. */
export const DEV_PAGE_PATH = `/${DEV_MOUNT_PATH}/index.html`;

/** The generated entry module every DOM component's development bundle starts from. */
export const DEV_ENTRY_PATH = `/${DEV_MOUNT_PATH}/entry.bundle`;

/** The websocket DOM components receive Fast Refresh updates on. */
export const DEV_HOT_PATH = `/${DEV_MOUNT_PATH}/hot`;
