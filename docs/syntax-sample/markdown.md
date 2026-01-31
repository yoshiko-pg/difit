# Markdown All Syntax Sample

> This file demonstrates **GitHub Flavored Markdown (GFM)** and common extensions.
> It is intended as a broad, not exhaustive, sample.

## Table of Contents

- [Headings](#headings)
- [Text](#text)
- [Links](#links)
- [Images](#images)
- [Lists](#lists)
- [Code](#code)
- [Tables](#tables)
- [Quotes](#quotes)
- [Horizontal Rules](#horizontal-rules)
- [Footnotes](#footnotes)
- [HTML](#html)
- [Escapes](#escapes)

## Headings

# H1

## H2

### H3

#### H4

##### H5

###### H6

## Text

Normal paragraph text with a hard line break at the end of this line.  
Next line starts after the hard break.

_Italic_, **bold**, **_bold italic_**, ~~strikethrough~~, `inline code`.

Mixing **bold with _italic_** and ~~**bold strikethrough**~~.

<u>Underline</u>, <sup>superscript</sup>, <sub>subscript</sub> (HTML inline).

Emoji: :sparkles: :rocket: :white_check_mark:

## Links

Inline link to [README](../README.md).

Autolink: <https://example.com>

Reference link: [Docs][docs-link]

Reference link with title: [Example][example-link]

## Images

Inline image:

![Screenshot](images/screenshot.png 'Docs screenshot')

Reference image:

![Screenshot ref][screenshot-img]

## Lists

Unordered list:

- Item A
- Item B
  - Nested B.1
  - Nested B.2
    - Nested B.2.a

Ordered list:

1. First
2. Second
3. Third

Task list:

- [x] Done item
- [ ] Pending item

Mixed list:

1. Ordered parent
   - Unordered child
   - Another child
2. Next parent

Definition-like list (non-standard, rendered by some parsers):

Term 1
: Definition 1

Term 2
: Definition 2

## Code

Inline code: `<p>Hello</p>`

Indented code block:

    const indented = true;
    console.log(indented);

Fenced code block (TypeScript):

```ts
type User = {
  id: string;
  name: string;
};

const user: User = { id: 'u1', name: 'Ada' };
console.log(user);
```

Fenced code block (JSON):

```json
{
  "name": "difit",
  "private": true,
  "scripts": {
    "dev": "pnpm dev"
  }
}
```

## Tables

| Column A | Column B | Column C |
| :------- | :------: | -------: |
| Left     |  Center  |    Right |
| A1       |    B1    |       C1 |

## Quotes

> Single-level quote.
>
> - Quoted list item
> - Another item
>
> > Nested quote.

## Horizontal Rules

---

***

___

## Footnotes

This sentence has a footnote.[^1]

Another footnote with label.[^note]

## HTML

<!-- HTML comment -->

<details>
  <summary>Expandable content</summary>
  <p>HTML block inside details.</p>
</details>

<div>
  <strong>HTML block</strong> with a line break.<br>
  Second line in the same block.
</div>

## Escapes

Escape literal characters: \* \_ \` \# \+ \- \! \[ \]

\# This is not a heading

\`Backticks\` around text

---

[docs-link]: ../README.md
[example-link]: https://example.com 'Example Domain'
[screenshot-img]: images/screenshot.png 'Docs screenshot'

[^1]: Footnote text for the first footnote.

[^note]: Second footnote text.
