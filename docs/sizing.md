# Sizing

A DOM component is a native view, laid out by React Native like any other. It sizes in one of two ways.

## Fill the parent (the default)

Without options, the view fills the space its parent gives it, as a view with `flex: 1` does. The page is as
wide and as tall as the view, and scrolls when its content is larger.

Give the parent a size, or let it grow:

```tsx
<View style={{ flex: 1 }}>
	<Map points={points} />
</View>
```

A parent that has no size of its own, such as a row in a `ScrollView`, gives the view zero height, and the
component doesn't show. Use `matchContents` there, or give the view a size through `dom.style`.

## Size to the content

With `matchContents`, the view's height follows the page's content, and changes as the content does, including
when fonts and images finish loading. The width still comes from layout: the page is as wide as the view.

```tsx
<ScrollView>
	<Article html={html} dom={{ matchContents: true, scrollEnabled: false }} />
</ScrollView>
```

The height is 0 until the page first reports it. Turn off `scrollEnabled` for a component inside a native
`ScrollView`, so that a drag scrolls the `ScrollView`.

The height measured is that of the page's content, so a page that fills the window (`height: 100vh`, or
`height: 100%` up to the root) has no height of its own to report. Let its content set the height instead.

## Fixed sizes

A size in `dom.style` wins over both modes:

```tsx
<Chart points={points} dom={{ style: { height: 240 } }} />
```
