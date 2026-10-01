# Assets

## Stylesheets

A DOM component, and any module it imports, can import a `.css` file. The stylesheet applies to the page, as a
`<link rel="stylesheet">` would:

```tsx
'use dom';

import './Card.css';

export default function Card({ title }: { title: string }) {
	return <h2 className="card-title">{title}</h2>;
}
```

Stylesheets from npm packages work the same way, for example `import 'katex/dist/katex.min.css'`.

Stylesheets are global: every rule applies to the whole page, which holds this one component. Editing a
stylesheet in development updates the page without a reload.

Add the type of stylesheet imports to the app once, in a `.d.ts` file such as `use-dom-env.d.ts`:

```ts
/// <reference types="react-native-use-dom/css" />
```

Not supported:

- `@import` of another local stylesheet inside a `.css` file. Import each stylesheet from JavaScript instead.
  `@import` of a full URL, such as a web font's stylesheet, loads it from the network as a browser would.
- CSS Modules: `import styles from './Card.module.css'` applies the stylesheet, but gives no class names.
- PostCSS, Tailwind and Sass processing. Build the CSS beforehand, and import the result.

## The `public` folder

Files in the `public` folder of the project, next to `metro.config.js`, can be loaded by the page by a URL
relative to it:

```text
public/
  logo.svg
  fonts/Inter.woff2
```

```tsx
<img src="logo.svg" alt="" />
```

```css
@font-face {
	font-family: Inter;
	src: url(fonts/Inter.woff2) format('woff2');
}
```

URLs inside an imported stylesheet resolve against the page too, so `url(fonts/Inter.woff2)` works from any
stylesheet.

In development, the dev server serves the folder. A release build copies it into the app, so the files load
without a network connection. Write relative URLs, without a leading `/`: they resolve in both.

A file the folder doesn't hold answers 404 in development, and isn't found in release.

## Other files

Importing an image, font or other file as a module, such as `import logo from './logo.png'`, is not supported.
Put it in `public` and load it by URL. Remote URLs, such as `https://…` images, load from the network as usual.
