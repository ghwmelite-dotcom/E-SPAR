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
  assert.equal(isAllowed("2026-06-10"), false); // first closed day after the early window
  assert.equal(isAllowed("2026-06-04"), false); // day before the window opens
  assert.equal(isAllowed("2026-07-01"), false); // after final session
});

test("nextSessionDate returns the next upcoming scheduled date", () => {
  assert.equal(nextSessionDate("2026-06-04"), "2026-06-05");
  assert.equal(nextSessionDate("2026-06-09"), "2026-06-22");
  assert.equal(nextSessionDate("2026-06-10"), "2026-06-22");
  assert.equal(nextSessionDate("2026-06-30"), null);
  assert.equal(nextSessionDate("2026-07-15"), null);
});

test("formatLongDate formats deterministically in UTC", () => {
  assert.equal(formatLongDate("2026-06-22"), "Monday, 22 June 2026");
  assert.equal(formatLongDate("2026-06-08"), "Monday, 8 June 2026");
});

test("closedPageHTML shows the next session date when sessions remain", () => {
  const html = closedPageHTML("2026-06-10");
  assert.match(html, /currently closed/);
  assert.match(html, /Monday, 22 June 2026/);
});

test("closedPageHTML shows concluded after the last session", () => {
  const html = closedPageHTML("2026-07-01");
  assert.match(html, /concluded/);
  assert.doesNotMatch(html, /opens on/);
});
