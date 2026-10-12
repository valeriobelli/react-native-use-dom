/**
 * The oldest React Native version the library's peer range declares. While React Native supports it,
 * its blocking cell tests it. Once React Native stops supporting it, a floor cell keeps testing it,
 * nightly, until the peer range is raised.
 *
 * It lives in its own module because the matrix, its compatibility page and the bare generator all
 * read it, and the matrix already imports the page.
 */
export const FLOOR_MINOR = '0.85'
