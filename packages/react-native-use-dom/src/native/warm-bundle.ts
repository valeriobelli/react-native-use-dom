/** Bundles already requested, so that every instance of a component starts its build once. */
const requested = new Set<string>()

/**
 * Asks the dev server for a DOM component's bundle, so that it starts building before the page asks.
 *
 * The page requests the same URL, and Metro answers it from the finished build. A failed request is
 * ignored: the page requests the bundle itself and shows the build error.
 */
export function warmDomBundle({ url }: { url: string }): void {
	if (requested.has(url)) {
		return
	}

	requested.add(url)

	void fetch(url).catch(() => null)
}
