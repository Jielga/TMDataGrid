---
name: playwright-advanced-inputs
description: >-
  How to drive advanced form inputs from Playwright — dropdowns/comboboxes,
  multi-selects, autocompletes, date pickers — focused on a durable method
  rather than a selector cheat-sheet. Covers the two structural facts that
  break naive selectors (dropdowns render in a portal on <body>; there are
  often two inputs — a visible control for display and a hidden input[name]
  for the submitted value), how to DISCOVER the correct role/name for any
  widget (aria snapshot, codegen, the accessibility tree, the role-priority
  ladder) instead of memorizing it, the general open → wait for the panel →
  pick pattern, and — when the widget is your own custom component that's
  hard to target — what to add to the source (roles, accessible names,
  data-testid, aria-expanded) to make it testable. Uses Mantine's Combobox
  family (Select, Autocomplete, MultiSelect, TagsInput, DatePickerInput) as
  the running example, but the method applies to any component library or
  hand-rolled widget. Use whenever writing Playwright interactions/locators
  against a non-trivial input, or deciding how to make a custom input
  testable.
---

# Driving advanced inputs from Playwright

Plain inputs (text, checkbox, radio) are easy. Compound widgets — comboboxes,
selects, multi-selects, autocompletes, date pickers — trip up most selector
attempts, because they render across a portal and split display from value.
This skill teaches how to *find* the right selector for whatever component and
version you're on, and how to *fix* a custom widget that resists targeting —
not a list of names to memorize, because accessible names and DOM details
drift across library versions and locales.

The worked examples use **Mantine**'s Combobox family (Select, Autocomplete,
MultiSelect, TagsInput, DatePickerInput), since that's a common source of
trouble, but nothing here is Mantine-only — the same method applies to
Radix, Headless UI, MUI, Ant Design, or a component you built yourself.

## Two structural facts that outlast any version

These are architectural, not cosmetic — they hold across most portal-based
dropdown widgets (Mantine 7/8/9, Radix, MUI, and hand-rolled ones alike), and
they explain the majority of failures:

1. **The dropdown is portaled.** When a Select/DatePicker opens, its options
   (and any footer buttons) are appended to the end of `<body>`, *not* nested
   inside the input's DOM. So `input.locator("[role=option]")` finds nothing —
   query from `page` (or from the dropdown's own root locator), which searches
   the whole document.
2. **There are usually two inputs.** The element the user sees is a visible
   control showing the *label* of the selection. The value the form submits
   lives in a separate **hidden `<input name="…">`**. Assert the visible one
   for what's displayed, the hidden one for what will be submitted. (Confirm
   this is true for your component by inspecting the DOM — see below — some
   custom widgets only have one.)

Everything else — which role, which accessible name — you should *discover*,
not assume.

## How to discover the correct selector

Don't guess names. Ask the running page what it exposes, then pick the
highest-priority stable handle. Four tools, roughly in order of usefulness:

### 1. Aria snapshot — the fastest way to see roles + names

Point Playwright at the open widget and print its accessibility tree:

```ts
// Open the widget first, then snapshot the portal/dropdown or the whole page:
console.log(await page.getByRole("dialog").ariaSnapshot());
// or the whole page if you're not sure where it rendered:
console.log(await page.locator("body").ariaSnapshot());
```

The output lists each element as `- role "Accessible Name"`, which is exactly
what `getByRole(role, { name })` consumes. This tells you the *real* role and
name for this version — e.g. whether the dropdown is a `listbox` or `dialog`,
whether the option name includes extra text, whether the date control is a
`button` or a `textbox`.

### 2. Codegen — record real interactions into suggested locators

```bash
npx playwright codegen http://localhost:5173
```

Click through the widget in the recorder; it emits the locator it would use.
Treat its output as a *starting suggestion* — codegen sometimes falls back to
text or nth-based locators, which you should then upgrade to a role/testid per
the ladder below.

### 3. The browser accessibility panel

DevTools → Elements → Accessibility shows the computed role and accessible
name for whatever you have selected. Useful to understand *why* a name is what
it is (which label/aria-label/text content contributes to it).

### 4. Trial-run a locator without asserting

```ts
await page.getByRole("option", { name: "Germany" }).highlight(); // visual check
console.log(await page.getByRole("option").allInnerTexts());     // what's there
```

### Which handle to keep — the role-priority ladder

Once the snapshot shows you what's available, prefer, in order:

1. **`getByRole(role, { name })`** — the accessible name from the snapshot.
   Survives markup/style churn and matches how assistive tech finds it.
2. **`getByLabel` / `getByPlaceholder`** for form fields tied to a `<label>`.
3. **`data-testid`** (`getByTestId`) for elements with no meaningful role or
   stable name — icon-only buttons, dense repeated rows, the hidden value
   input if it has no better handle.
4. **A documented, stable data attribute** the library guarantees (Mantine's
   `data-*` hooks, e.g. the date control's `data-dates-input`). Acceptable
   because it's an API contract, not styling.
5. **Never** CSS class chains or `nth-child`/XPath — they couple to structure
   that changes for reasons unrelated to the feature.

The one routine CSS exception is the hidden value input: `input[name="age"]`
targets a form contract (`name`), not styling, and often has no role to use.

## The general Combobox interaction

Regardless of the exact names you discovered, the *shape* of the interaction
is stable across the Select/Autocomplete/MultiSelect/TagsInput family:

```ts
// 1. Open — click the visible control (discover its role+name via snapshot).
await control.click();

// 2. Wait for the dropdown to actually be present before touching options.
//    The dropdown is portaled AND animated, so clicking an option too early
//    races. Wait on whatever the snapshot showed the dropdown's role to be
//    (commonly a listbox whose accessible name matches the control's).
await expect(dropdown).toBeVisible();

// 3. Pick by the option role — NOT by getByText, which also matches table
//    cells, chips, and other elements sharing the label text.
await option.click();
```

Behaviors that differ within the family (verify against your version, but
these are long-standing):

- **Select / Autocomplete** close the dropdown on pick; reopen to change the
  choice.
- **MultiSelect / TagsInput** stay open on pick, so batch several clicks then
  close with `Escape` or an outside click.
- **Plain Select is read-only** — `fill()` throws "not editable"; you must
  open and click. A `searchable` Select / Autocomplete / TagsInput is
  editable, so `fill()` filters the list. If `fill()` fails, that's the signal
  the widget isn't searchable — don't reach for `force: true`.

### Custom Combobox with a footer "OK/Apply" button

A Combobox with a footer confirm button keeps the dropdown open until you
click it. That button lives **inside the portaled dropdown**, so it's
reachable from `page` by role *while the dropdown is open* — never click the
page body to "commit," which dismisses the dropdown and may discard the
pending selection. Assert the dropdown is still visible right before clicking
the confirm button so a premature close fails at its real cause.

## Date inputs

Discover the control's role first — it is often a **`<button>`**, not a
`textbox` (so you open it with a button click, not `fill()`), and it usually
carries a stable data attribute you can fall back on. Calendar days are
typically `<button>`s inside a `<table>` whose accessible name is the day
number — match with `{ exact: true }` so "1" doesn't also hit "11"/"21", and
scope to the open calendar's root locator so a two-month range view doesn't
give you two matches. Month/year navigation and the free-typing `DateInput`
variant both expose accessible controls — snapshot the open calendar once to
read the exact names for your version and locale.

## When the widget is *your* custom component: make it testable

If a widget resists every stable handle — the snapshot shows a bare `generic`
with no role, no accessible name, options that are plain `div`s — the right
fix is usually in the **source**, not a brittle CSS selector in the test. A
custom component that's hard for Playwright to target is also inaccessible to
screen-reader users, so these changes pay off twice. Suggest, in preference
order:

- **Add the correct ARIA roles/relationships.** A custom dropdown should be
  `role="combobox"` with `aria-expanded` on the trigger, `role="listbox"` on
  the panel, and `role="option"` on each item. This unlocks
  `getByRole("option", …)` and the standard pattern above with zero test-only
  cruft.
- **Give interactive elements an accessible name.** Wire a `<label htmlFor>`,
  or add `aria-label` / `aria-labelledby` to icon-only buttons and the
  trigger. Then `getByRole("button", { name })` / `getByLabel` just work.
- **Expose `aria-expanded` / `aria-selected` state** on the trigger and
  options so tests can assert open/closed and selection through the
  accessibility tree instead of by inspecting classes.
- **Add `data-testid` as a last resort** for elements with genuinely no role
  or stable name (a decorative container you must scope to, the hidden value
  input). Prefer a role/name; reach for testid only when there isn't one.
- **Surface the submitted value** in a hidden `input[name]` (or a
  `data-value` attribute) if the component only renders a display label — so
  tests can assert what will actually be submitted.

Frame these as accessibility improvements in the component, not "changes for
the test." A rendered value the test can read and a role the test can target
are the same properties assistive tech needs.

## Plain inputs (the easy ones)

Single real element each — discover the label from the snapshot and use
`getByLabel` / `getByRole`. Notes worth knowing: Mantine's `NumberInput` is a
formatted **`role="textbox"`**, not `spinbutton`; `Checkbox`/`Switch`/`Radio`
expose `checkbox`/`switch`/`radio` roles; a `Slider` is `role="slider"` driven
by keyboard arrows, not a drag. Prefer `getByLabel` over `getByPlaceholder` —
labels are associated with the input and churn less than placeholder copy.

## Gotchas checklist

- **Portaled dropdown/calendar** — query options and footer buttons from
  `page` (or the dropdown's root locator), never from the input locator.
- **Two inputs** — visible control = display label; hidden `input[name]` =
  submitted value. Assert the right one for what you're checking.
- **Wait for the dropdown to be visible before clicking options** — it's
  portaled and animated; clicking too early races.
- **`role="option"`, not `getByText`** — text matching also hits table cells
  and chips sharing the label.
- **Plain Select is read-only** — `fill()` throws; open and click. `searchable`
  makes it typeable.
- **Never `force: true` to get past "not editable"/"not visible"** — it hides
  the real reason (wrong element, dropdown not open, animation) and flakes.
- **Discover, don't assume** — when a name or role doesn't match, re-run
  `ariaSnapshot()` on the open widget rather than guessing the next string.

## Where these locators belong

Don't copy-paste this interaction logic per test — a Select appears on many
pages and its open→wait→pick dance should live in one place, parameterized by
the accessible name so the discovered selectors sit in a single class. If you
use the Page Object / component-object pattern, this is a component object;
otherwise a small helper class or function works the same way:

```ts
export class MantineSelect {
  constructor(private readonly page: Page, private readonly label: string) {}

  private control() {
    return this.page.getByRole("textbox", { name: this.label });
  }
  private dropdown() {
    // Adjust role/name to whatever ariaSnapshot() shows for your version.
    return this.page.getByRole("listbox", { name: this.label });
  }

  async select(optionLabel: string) {
    await this.control().click();
    await expect(this.dropdown()).toBeVisible();
    await this.page.getByRole("option", { name: optionLabel }).click();
  }

  value() {
    return this.control();
  }
}
```

If your version's names differ, you change them in this one class, not across
every test — which is the whole point of not hard-coding them everywhere.
