---
name: playwright-page-object
description: >-
  Best practices for structuring Playwright Page Object Models (POMs) —
  project setup (folder layout, base class, fixtures for auto-instantiation),
  writing resilient selectors (role/testid priority, locators as lazy getters,
  never raw CSS/XPath), and long-term maintenance (thin action methods, no
  assertions baked into page objects, keeping mock/route interception out of
  the page object, component objects for repeated widgets, avoiding god
  objects). Generic Playwright guidance, not tied to this repo's
  stack. Use whenever creating, reviewing, or refactoring a Playwright page
  object.
---

# Playwright Page Object best practices

A page object's only job is to translate "what a user can do/see on this
page" into a typed API. It knows *where things are* and *how to interact with
them*; it does not know *what the test expects*.

## Setup

### Folder layout — follow your project's convention, not a prescribed one

There is no required directory structure. Put page objects wherever your
project already keeps test code so they sit next to the tests that use them.
Two common conventions, both fine:

```
# Centralized e2e/ tree
e2e/
  pages/       login.page.ts, employee-list.page.ts
  components/  data-table.component.ts
  fixtures.ts
  tests/       login.spec.ts

# Colocated with the feature (e.g. src/pages/<page>/__test__/)
src/pages/employees/__test__/
  employees.spec.ts
  employees.page.ts      # the page object next to its test
  data-table.component.ts
```

Pick whichever matches the surrounding codebase — if your app colocates tests
under `src/pages/<page>/__test__/`, put the page object there too; don't
introduce a parallel `e2e/` tree just to satisfy a convention. Shared
components/fixtures can live in a common folder the features import from.

What actually matters is not the folders but the **separation of concerns**:
split **pages** (a full route/screen) from **components** (a repeated widget —
a table, modal, nav bar — appearing on multiple pages). A page composes
components; components never instantiate pages. That boundary holds regardless
of where the files sit.

### Wire page objects through fixtures, not constructors in every test

Manually instantiating `new EmployeeListPage(page)` in every test file is the
#1 thing that makes POMs feel like boilerplate. Extend Playwright's `test`
instead:

```ts
// fixtures.ts
import { test as base } from "@playwright/test";
import { EmployeeListPage } from "./pages/employee-list.page";
import { LoginPage } from "./pages/login.page";

type Fixtures = {
  loginPage: LoginPage;
  employeeListPage: EmployeeListPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  employeeListPage: async ({ page }, use) => use(new EmployeeListPage(page)),
});
export { expect } from "@playwright/test";
```

```ts
// employee-list.spec.ts
import { test, expect } from "../fixtures";

test("filters by department", async ({ employeeListPage }) => {
  await employeeListPage.goto();
  await employeeListPage.filterByDepartment("Engineering");
  await expect(employeeListPage.rows()).toHaveCount(3);
});
```

Fixtures are lazily created only when a test declares them as a parameter, so
adding ten page objects to `fixtures.ts` costs nothing for tests that use one.

### A thin base class, not a framework

```ts
// base.page.ts
import type { Page } from "@playwright/test";

export abstract class BasePage {
  constructor(protected readonly page: Page) {}
  abstract readonly path: string;

  async goto() {
    await this.page.goto(this.path);
  }
}
```

Resist the urge to grow this into a generic "framework" with retry helpers,
custom wait utilities, or logging wrappers — Playwright's own auto-waiting
and `expect.poll` already cover that. A base class that just holds `page` and
a `goto()` convention is enough; extra machinery here is the first step
toward an unmaintainable abstraction layer that hides what Playwright is
actually doing.

## Writing selectors

Priority order, same as Playwright's own guidance — pick the first one that
uniquely identifies the element:

1. **`getByRole`** with the accessible name — `page.getByRole("button", { name: "Save" })`.
   Matches how a user/assistive tech finds the element and survives markup
   churn (div → button, class renames).
2. **`getByLabel` / `getByPlaceholder` / `getByText`** for form fields and
   copy-driven content.
3. **`data-testid`** for elements with no meaningful role or stable text
   (icon-only buttons, decorative containers, dense repeated rows). Add the
   attribute in app code rather than reaching for structural selectors.
4. **Never** CSS class selectors, tag+nth-child chains, or XPath. They couple
   the test to implementation details (styling, DOM nesting) that change for
   reasons that have nothing to do with the feature under test.

```ts
// Good — resilient to markup/style changes
saveButton() {
  return this.page.getByRole("button", { name: "Save" });
}

// Bad — breaks the moment a wrapper div is added or a class is renamed
saveButton() {
  return this.page.locator(".toolbar > div:nth-child(2) button.btn-primary");
}
```

### Locators as lazy getters/methods, never eagerly-resolved fields

```ts
// Good — resolved fresh every call, always points at the live DOM
rows() {
  return this.page.getByRole("row").filter({ hasNot: this.page.getByRole("columnheader") });
}

// Bad — captured once at construction time, before the page has rendered;
// stale after any re-render/navigation and easy to forget to re-query
rows = this.page.locator("tr");
```

Playwright locators are cheap, lazy query descriptions, not live handles —
returning a fresh one from a method/getter every call is the correct and
idiomatic pattern (mirrors Playwright's own examples), not a performance
concern to work around.

### Don't couple locators to copy that changes per locale/wording

`getByText("Kamera_A")` also matches table cells with the same text, and
breaks on copy edits or i18n. Prefer `getByRole` with a name pulled from a
shared constant, or `data-testid`, for anything that isn't the specific copy
under test.

## Structuring the page object

### Action methods mirror user behavior, not implementation

```ts
export class LoginPage extends BasePage {
  readonly path = "/login";

  private emailInput() {
    return this.page.getByLabel("Email");
  }
  private passwordInput() {
    return this.page.getByLabel("Password");
  }
  private submitButton() {
    return this.page.getByRole("button", { name: "Log in" });
  }

  async loginAs(email: string, password: string) {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }
}
```

Individual field locators are private; only the behavior (`loginAs`) is
public API. This keeps the page object's surface small and means a field
being renamed/restructured only touches one method.

### Expose locators for assertions; don't assert inside the page object

```ts
// Good — page object hands back a locator, the test decides what to assert
export class EmployeeListPage extends BasePage {
  rows() {
    return this.page.getByRole("row").filter({ hasNot: this.page.getByRole("columnheader") });
  }
}

test("shows filtered results", async ({ employeeListPage }) => {
  await expect(employeeListPage.rows()).toHaveCount(3);
});

// Bad — assertion is now hidden inside the page object and can't be
// customized per test (exact count vs "at least one" vs a poll)
export class EmployeeListPage extends BasePage {
  async expectRowCount(n: number) {
    expect(await this.page.getByRole("row").count()).toBe(n);
  }
}
```

The one exception worth allowing is a `waitForLoaded()`-style method that
waits for the page's defining element to appear — that's setup, not a test
assertion, and belongs in the page object so every test doesn't repeat it.

### Return values, not raw Playwright primitives, where it aids readability

Methods that read data back (e.g. "get the currently selected row's name")
can return plain strings/objects instead of locators — but keep this rare
and only where the test genuinely wants a value, not a thing to assert on.

### Component objects for repeated widgets

If a table, modal, or dropdown appears on more than one page, model it as
its own class the page composes, not a copy-pasted set of locators per page:

```ts
export class DataTableComponent {
  constructor(private readonly root: Locator) {}

  rows() {
    return this.root.getByRole("row").filter({ hasNot: this.root.getByRole("columnheader") });
  }
  async sortBy(column: string) {
    await this.root.getByRole("columnheader", { name: column }).click();
  }
}

export class EmployeeListPage extends BasePage {
  readonly path = "/employees";
  readonly table = new DataTableComponent(this.page.getByRole("table"));
}
```

```ts
await employeeListPage.table.sortBy("Name");
await expect(employeeListPage.table.rows()).toHaveCount(10);
```

This is the mechanism that keeps maintenance cheap: when the table's markup
changes, one component class changes, not every page that embeds a table.

## Keep mock/route setup out of the page object

Network mocking (`page.route(...)`, request interception, seeded API
responses) is **test-data setup, not page structure** — keep it out of the
page object entirely. The same page object must work unchanged whether a test
mocks the API, hits a real backend, or uses a different mock scenario. A page
object knows *where things are and how to interact with them*; it must not
know *what data the server returns*.

The tell that this line has been crossed: the page object grows a constructor
param or a method per scenario (`new EmployeeListPage(page, mockData)`,
`employeeListPage.mockEmptyState()`). Every new test scenario then forces an
edit to a class that's supposed to be a stable abstraction, and the mocking
logic gets copy-pasted into whichever page happens to trigger the request.

Put mocks in their own module and compose them **alongside** the page object
as a sibling fixture, so each stays responsible for one axis of change —
selectors/actions (change when the UI changes) vs. response data (changes per
scenario):

```ts
// mocks/employees.mock.ts
import type { Page } from "@playwright/test";
import type { Employee } from "../../src/types";

export async function mockEmployees(page: Page, employees: Employee[]) {
  await page.route("**/api/employees*", (route) =>
    route.fulfill({ json: employees }),
  );
}
```

```ts
// fixtures.ts — mocking helper is a fixture, not a page-object method
export const test = base.extend<Fixtures>({
  employeeListPage: async ({ page }, use) => use(new EmployeeListPage(page)),
  mockEmployees: async ({ page }, use) =>
    use((employees: Employee[]) => mockEmployees(page, employees)),
});
```

```ts
// employee-list.spec.ts — test wires the two together; POM stays data-agnostic
test("shows an empty state", async ({ employeeListPage, mockEmployees }) => {
  await mockEmployees([]);
  await employeeListPage.goto();
  await expect(employeeListPage.emptyState()).toBeVisible();
});

test("lists returned employees", async ({ employeeListPage, mockEmployees }) => {
  await mockEmployees([alice, bob, carol]);
  await employeeListPage.goto();
  await expect(employeeListPage.rows()).toHaveCount(3);
});
```

Register broad, scenario-agnostic routes (blanket 404s for unmocked
endpoints, auth stubs shared by every test) in a fixture or global setup, not
in individual page objects. The cost of this split is two files to open
instead of one; the payoff is that a UI change never touches mock code and a
new data scenario never touches a page object.

## Maintaining page objects

- **One class per page/component, not per test.** If a locator or action only
  exists to serve a single test, question whether it belongs in the shared
  page object at all — a local `const` in that test file is fine for
  one-offs; promote it once a second test needs it.
- **Keep the public API behavior-shaped.** `loginAs(email, password)`, not
  `fillEmail()` + `fillPassword()` + `clickSubmit()` as three separate public
  calls every test has to sequence identically. Fewer, higher-level methods
  mean a UI restructuring (e.g., login becomes a two-step wizard) is fixed in
  one place.
- **No conditional logic based on what's currently rendered.**
  `if (await button.isVisible()) await button.click()` inside a page object
  hides real bugs (the button should always be there) and makes failures
  silent. Assert the precondition or make the caller handle the branch
  explicitly.
- **No manual `waitForTimeout`/sleeps.** Rely on Playwright's auto-waiting
  (actions wait for actionability) and `expect(locator)...` /
  `expect.poll(...)` for anything async (debounced writes, animations). A
  fixed sleep is either too short (flaky) or too long (slow suite) and never
  the right duration for both CI and local runs.
- **Don't leak the raw `Page` object needlessly.** If every test reaches
  through `employeeListPage.page.locator(...)` to work around a missing
  method, that's a signal the page object is missing an abstraction — add
  the method rather than normalizing bypassing the class.
- **Version selectors alongside the feature, not separately.** When you
  rename a `data-testid` or restructure a component's markup, update its page
  object in the same commit — a page object that lags the app is worse than
  no page object, since it fails for reasons unrelated to the change under
  test.
- **Don't build a page object for a page you're only visiting once.** POMs
  pay off through reuse across tests. A one-off diagnostic page hit by a
  single test doesn't need the ceremony — inline locators are fine until a
  second test shows up.

## Anti-patterns to avoid

- **God page object** — one class covering the whole app's locators because
  "everything is reachable from here." Split by route/component instead.
- **Locators as public fields computed in the constructor** (see above) —
  goes stale, silently points at pre-render DOM.
- **Assertions embedded in page object methods** — removes the test's
  ability to choose count vs visibility vs polling, and makes failures report
  from inside the page object instead of the test.
- **Mock/route setup inside the page object** — a `mockData` constructor
  param or `mock*()` method forces the class to grow per test scenario; keep
  interception in a sibling fixture/module so the POM stays data-agnostic.
- **A generic `BasePage` that wraps every Playwright API** (`clickByText`,
  `waitAndClick`, `safeFill`) — this is usually working around not trusting
  Playwright's auto-waiting, and it obscures actionability failures instead
  of surfacing them.
- **Selector strategy mixing CSS classes and roles inconsistently across the
  same page object** — pick role/testid as the default and keep it uniform so
  a reviewer can trust the pattern without re-checking every locator.
