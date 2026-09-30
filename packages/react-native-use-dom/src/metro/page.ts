/**
 * The HTML page a DOM component renders in, in development and in release alike: an empty root the
 * component mounts into, and the script that loads it.
 */
export function renderPage(script: string): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
<div id="root"></div>
${script}
</body>
</html>
`;
}

/** JSON is valid JavaScript, but `</script>` inside it would end the script element early. */
export function inlineJson(value: string): string {
	return JSON.stringify(value).replaceAll('<', '\\u003c');
}
