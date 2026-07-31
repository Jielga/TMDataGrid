import { describe, expect, it } from "vitest";
import {
  getDefaultOperator,
  getOperatorsForType,
  isFilterActive,
  isTMDataGridFilterValue,
  matchesFilter,
  operatorNeedsValue,
  operatorTakesArrayValue,
  type TMDataGridFilterOperator,
} from "./filterOperators";

const match = (
  cellValue: unknown,
  operator: TMDataGridFilterOperator,
  value: string | ReadonlyArray<string> = "",
) => matchesFilter(cellValue, { operator, value });

describe("matchesFilter", () => {
  describe("string operators", () => {
    it("compares case-insensitively", () => {
      expect(match("Stockholm", "contains", "STOCK")).toBe(true);
      expect(match("Stockholm", "equals", "stockholm")).toBe(true);
      expect(match("Stockholm", "startsWith", "STO")).toBe(true);
      expect(match("Stockholm", "endsWith", "HOLM")).toBe(true);
    });

    it("rejects what does not match", () => {
      expect(match("Stockholm", "contains", "Malmö")).toBe(false);
      expect(match("Stockholm", "startsWith", "holm")).toBe(false);
      expect(match("Stockholm", "endsWith", "stock")).toBe(false);
      expect(match("Stockholm", "notEquals", "Stockholm")).toBe(false);
      expect(match("Stockholm", "notEquals", "Malmö")).toBe(true);
    });

    it("coerces a non-string cell to text", () => {
      expect(match(42, "contains", "4")).toBe(true);
      expect(match(null, "contains", "null")).toBe(false);
      expect(match(undefined, "startsWith", "undef")).toBe(false);
    });

    it("trims the needle and matches everything when it is blank", () => {
      expect(match("Stockholm", "contains", "  stock  ")).toBe(true);
      expect(match("Stockholm", "equals", "   ")).toBe(true);
    });
  });

  describe("numeric operators", () => {
    it("compares numerically when both sides are numbers", () => {
      expect(match(50, "greaterThan", "40")).toBe(true);
      expect(match(50, "greaterThanOrEqual", "50")).toBe(true);
      expect(match(50, "lessThan", "60")).toBe(true);
      expect(match(50, "lessThanOrEqual", "50")).toBe(true);
      expect(match(50, "lessThan", "40")).toBe(false);
    });

    it("prefers a numeric comparison for equals on numeric cells", () => {
      // "50" and "50.0" are different strings but the same number.
      expect(match(50, "equals", "50.0")).toBe(true);
      expect(match(50, "notEquals", "50.0")).toBe(false);
    });

    it("never matches an ordering operator on a non-numeric cell", () => {
      expect(match("Stockholm", "greaterThan", "40")).toBe(false);
      expect(match(null, "lessThan", "40")).toBe(false);
      expect(match(50, "greaterThan", "abc")).toBe(false);
    });
  });

  describe("date operators", () => {
    it("orders by calendar day, for Date cells and ISO-string cells alike", () => {
      const day = new Date(2026, 6, 15); // 2026-07-15 local
      expect(match(day, "before", "2026-07-16")).toBe(true);
      expect(match(day, "before", "2026-07-15")).toBe(false);
      expect(match(day, "after", "2026-07-14")).toBe(true);
      expect(match(day, "onOrBefore", "2026-07-15")).toBe(true);
      expect(match(day, "onOrAfter", "2026-07-15")).toBe(true);
      expect(match("2026-07-15", "before", "2026-07-16")).toBe(true);
      expect(match("2026-07-15T09:30:00", "onOrAfter", "2026-07-15")).toBe(true);
    });

    it("treats equals as day equality for a Date cell", () => {
      expect(match(new Date(2026, 6, 15), "equals", "2026-07-15")).toBe(true);
      expect(match(new Date(2026, 6, 15), "equals", "2026-07-16")).toBe(false);
      expect(match(new Date(2026, 6, 15), "notEquals", "2026-07-16")).toBe(true);
    });

    it("never matches an ordering operator on something that has no day", () => {
      expect(match("Stockholm", "before", "2026-07-16")).toBe(false);
      expect(match(null, "after", "2026-07-16")).toBe(false);
      expect(match(new Date(2026, 6, 15), "before", "not a date")).toBe(false);
    });
  });

  describe("set operators", () => {
    it("tests scalar cells for membership", () => {
      expect(match("Paid", "isAnyOf", ["Paid", "Pending"])).toBe(true);
      expect(match("Overdue", "isAnyOf", ["Paid", "Pending"])).toBe(false);
      expect(match("Overdue", "isNoneOf", ["Paid", "Pending"])).toBe(true);
      expect(match("Paid", "isNoneOf", ["Paid"])).toBe(false);
    });

    it("intersects array cells with the set", () => {
      expect(match(["a", "b"], "isAnyOf", ["b", "c"])).toBe(true);
      expect(match(["a", "b"], "isAnyOf", ["c"])).toBe(false);
      expect(match(["a", "b"], "isNoneOf", ["c"])).toBe(true);
      expect(match(["a", "b"], "isNoneOf", ["b"])).toBe(false);
    });

    it("compares case-insensitively and matches everything on an empty set", () => {
      expect(match("PAID", "isAnyOf", ["paid"])).toBe(true);
      expect(match("anything", "isAnyOf", [])).toBe(true);
      expect(match("anything", "isNoneOf", [])).toBe(true);
    });
  });

  describe("valueless operators", () => {
    it("treats null, undefined and empty string as empty", () => {
      expect(match(null, "isEmpty")).toBe(true);
      expect(match(undefined, "isEmpty")).toBe(true);
      expect(match("", "isEmpty")).toBe(true);
      expect(match(0, "isEmpty")).toBe(false);
      expect(match("x", "isEmpty")).toBe(false);
    });

    it("inverts for isNotEmpty", () => {
      expect(match(null, "isNotEmpty")).toBe(false);
      expect(match(0, "isNotEmpty")).toBe(true);
      expect(match("x", "isNotEmpty")).toBe(true);
    });

    it("ignores any value carried alongside", () => {
      expect(match(null, "isEmpty", "ignored")).toBe(true);
    });
  });
});

describe("isFilterActive", () => {
  it("is false for anything that is not a filter value", () => {
    expect(isFilterActive(undefined)).toBe(false);
    expect(isFilterActive(null)).toBe(false);
    expect(isFilterActive("contains")).toBe(false);
    expect(isFilterActive({ value: "x" })).toBe(false);
  });

  it("is false while a value operator has nothing to compare", () => {
    expect(isFilterActive({ operator: "contains", value: "" })).toBe(false);
    expect(isFilterActive({ operator: "contains", value: "   " })).toBe(false);
    expect(isFilterActive({ operator: "contains", value: "a" })).toBe(true);
  });

  it("is true for a valueless operator regardless of value", () => {
    expect(isFilterActive({ operator: "isEmpty", value: "" })).toBe(true);
    expect(isFilterActive({ operator: "isNotEmpty", value: "" })).toBe(true);
  });

  it("follows the set's emptiness for an array value", () => {
    expect(isFilterActive({ operator: "isAnyOf", value: [] })).toBe(false);
    expect(isFilterActive({ operator: "isAnyOf", value: ["Paid"] })).toBe(true);
  });
});

describe("isTMDataGridFilterValue", () => {
  it("requires a string operator", () => {
    expect(isTMDataGridFilterValue({ operator: "contains", value: "" })).toBe(
      true,
    );
    expect(isTMDataGridFilterValue({ operator: 1, value: "" })).toBe(false);
    expect(isTMDataGridFilterValue({ value: "" })).toBe(false);
    expect(isTMDataGridFilterValue(null)).toBe(false);
    expect(isTMDataGridFilterValue("contains")).toBe(false);
  });
});

describe("operator sets", () => {
  it("offers ordering operators to numbers only", () => {
    expect(getOperatorsForType("number")).toContain("greaterThan");
    expect(getOperatorsForType("string")).not.toContain("greaterThan");
    expect(getOperatorsForType("string")).toContain("contains");
  });

  it("defaults to contains for strings and equals for numbers", () => {
    expect(getDefaultOperator("string")).toBe("contains");
    expect(getDefaultOperator("number")).toBe("equals");
  });

  it("agrees with itself about which operators take a value", () => {
    expect(operatorNeedsValue("contains")).toBe(true);
    expect(operatorNeedsValue("isEmpty")).toBe(false);
    expect(operatorNeedsValue("isNotEmpty")).toBe(false);
  });

  it("gives each new type its own set", () => {
    expect(getOperatorsForType("date")).toContain("before");
    expect(getOperatorsForType("date")).not.toContain("contains");
    expect(getOperatorsForType("boolean")).toEqual([
      "equals",
      "notEquals",
      "isEmpty",
      "isNotEmpty",
    ]);
    expect(getOperatorsForType("select")).toContain("isAnyOf");
    expect(getOperatorsForType("multiSelect")).toContain("isNoneOf");
    expect(getOperatorsForType("select")).not.toContain("equals");
  });

  it("marks exactly the set operators as array-valued", () => {
    expect(operatorTakesArrayValue("isAnyOf")).toBe(true);
    expect(operatorTakesArrayValue("isNoneOf")).toBe(true);
    expect(operatorTakesArrayValue("equals")).toBe(false);
    expect(operatorTakesArrayValue("before")).toBe(false);
  });

  it("only offers operators the default is a member of", () => {
    for (const type of [
      "string",
      "number",
      "boolean",
      "date",
      "select",
      "multiSelect",
    ] as const) {
      expect(getOperatorsForType(type)).toContain(getDefaultOperator(type));
    }
  });
});
