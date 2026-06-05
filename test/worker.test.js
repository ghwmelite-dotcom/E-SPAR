import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_DATES,
  gmtDateString,
  isAllowed,
  nextSessionDate,
  formatLongDate,
  closedPageHTML,
} from "../public/_worker.js";

test("gmtDateString returns YYYY-MM-DD in UTC regardless of time", () => {
  assert.equal(gmtDateString(new Date("2026-06-08T00:00:00Z")), "2026-06-08");
  assert.equal(gmtDateString(new Date("2026-06-08T13:45:00Z")), "2026-06-08");
  assert.equal(gmtDateString(new Date("2026-06-08T23:59:59Z")), "2026-06-08");
});

test("isAllowed is true only on scheduled dates", () => {
  for (const d of ALLOWED_DATES) assert.equal(isAllowed(d), true);
  assert.equal(isAllowed("2026-06-10"), false); // gap between sessions
  assert.equal(isAllowed("2026-06-07"), false); // day before first session
  assert.equal(isAllowed("2026-07-01"), false); // after final session
});

test("nextSessionDate returns the next upcoming scheduled date", () => {
  assert.equal(nextSessionDate("2026-06-05"), "2026-06-08");
  assert.equal(nextSessionDate("2026-06-08"), "2026-06-09");
  assert.equal(nextSessionDate("2026-06-10"), "2026-06-22");
  assert.equal(nextSessionDate("2026-06-30"), null);
  assert.equal(nextSessionDate("2026-07-15"), null);
});

test("formatLongDate formats deterministically in UTC", () => {
  assert.equal(formatLongDate("2026-06-22"), "Monday, 22 June 2026");
  assert.equal(formatLongDate("2026-06-08"), "Monday, 8 June 2026");
});

test("closedPageHTML shows the next session date when sessions remain", () => {
  const html = closedPageHTML("2026-06-05");
  assert.match(html, /currently closed/);
  assert.match(html, /Monday, 8 June 2026/);
});

test("closedPageHTML shows concluded after the last session", () => {
  const html = closedPageHTML("2026-07-01");
  assert.match(html, /concluded/);
  assert.doesNotMatch(html, /opens on/);
});
