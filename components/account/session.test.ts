import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProblem } from "./session.ts";

test("new passwords need 8 to 72 characters with a letter and a number", () => {
  for (const bad of ["", "abc12", "abcdefgh", "12345678", "a1".repeat(37)]) assert.ok(passwordProblem(bad), bad);
  for (const good of ["amorphix2026", "Pune house 7", "a1".repeat(36)]) assert.equal(passwordProblem(good), null, good);
});
