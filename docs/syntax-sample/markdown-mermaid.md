# Markdown Mermaid Preview Sample

This file is for checking `Diff Preview` and `Full Preview` rendering with Mermaid diagrams.

## Checklist

- [x] Headings
- [x] Paragraphs
- [x] GFM task list
- [x] Tables
- [x] Mermaid flowchart
- [x] Mermaid sequence diagram
- [x] Mermaid state diagram

## Flowchart

The diagram below is a simple review flow.

```mermaid
flowchart TD
  Draft["Write spec"] --> Review["Open difit preview"]
  Review --> Update["Update markdown"]
  Update --> Approve["Approve changes"]
```

## Sequence Diagram

This one is useful for checking wider diagrams and labels.

```mermaid
sequenceDiagram
  participant U as User
  participant D as difit
  participant G as Git

  U->>G: edit docs/syntax-sample/markdown-mermaid.md
  U->>D: open Diff Preview
  D-->>U: render Markdown + Mermaid
  U->>G: review and iterate
```

## State Diagram

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> InReview
  InReview --> Revised
  Revised --> InReview
  InReview --> Done
  Done --> [*]
```

## GFM Table

| Item | Purpose | Status |
| :--- | :------ | :----- |
| Flowchart | Basic Mermaid rendering | Ready |
| Sequence | Wide layout check | Ready |
| State | Alternative diagram syntax | Ready |

## Change Ideas

If you want to exercise `Diff Preview`, try changing one of these:

1. Rename `Write spec` to `Write test spec`
2. Add one more participant to the sequence diagram
3. Insert a new state between `Revised` and `Done`
