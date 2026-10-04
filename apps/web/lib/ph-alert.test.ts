import { expect, test } from "bun:test";
import { nextLowPhAlert } from "./ph-alert";

test("low pH alert holds through boundary noise and clears on recovery", () => {
  expect(nextLowPhAlert(false, 6.5, true)).toBe(false);
  expect(nextLowPhAlert(false, 6.49, true)).toBe(true);
  expect(nextLowPhAlert(true, 6.52, true)).toBe(true);
  expect(nextLowPhAlert(true, 6.59, true)).toBe(true);
  expect(nextLowPhAlert(true, 6.6, true)).toBe(false);
});

test("unavailable or invalid samples clear an active alert", () => {
  for (const ph of [null, NaN, Infinity]) expect(nextLowPhAlert(true, ph, true)).toBe(false);
  expect(nextLowPhAlert(true, 6, false)).toBe(false);
});
