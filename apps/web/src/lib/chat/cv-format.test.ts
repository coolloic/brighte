import { describe, expect, it } from "vitest";
import { dateRange, educationDates, formatDate } from "./cv-format";

describe("cv dates", () => {
  it.each([
    ["2019", "2019"],
    ["2019-03", "Mar 2019"],
    ["present", "Present"],
  ])("formats %j as %j", (date, shown) => expect(formatDate(date)).toBe(shown));

  it.each([
    ["2021-03", "present", "Mar 2021 – Present"],
    ["2017", "2021", "2017 – 2021"],
    ["2019", undefined, "From 2019"],
    [undefined, "2020", "Until 2020"],
    [undefined, "present", "Present"],
    [undefined, undefined, undefined],
  ])("dateRange(%j, %j) is %j", (start, end, shown) => expect(dateRange(start, end)).toBe(shown));

  it("shows a degree's lone end year as the year", () => {
    expect(educationDates(undefined, "2016")).toBe("2016");
    expect(educationDates("2013", "2016")).toBe("2013 – 2016");
  });
});
