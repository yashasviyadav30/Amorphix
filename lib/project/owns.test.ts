import { test } from "node:test";
import assert from "node:assert/strict";
import { ownsProject } from "./store.ts";

test("a guest's project opens in the browser that started it", () => {
  assert.equal(ownsProject({ owner_id: null, guest_id: "g1" }, { guestId: "g1" }), true);
  assert.equal(ownsProject({ owner_id: null, guest_id: "g1" }, { guestId: "g2", userId: "u9" }), false);
});

test("once an account owns a project, only that account opens it, not the old guest cookie", () => {
  const owned = { owner_id: "u1", guest_id: "g1" };
  assert.equal(ownsProject(owned, { userId: "u1" }), true);
  assert.equal(ownsProject(owned, { guestId: "g1" }), false);
  assert.equal(ownsProject(owned, { guestId: "g1", userId: "u2" }), false);
  assert.equal(ownsProject({ owner_id: null, guest_id: null }, {}), false);
});
