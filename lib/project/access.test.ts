import { test } from "node:test";
import assert from "node:assert/strict";
import { can, invitable, type Action, type ProjectRole } from "./access.ts";

const ALL: Action[] = ["view", "comment", "edit", "invite", "approve", "site", "message", "review"];
const allowed = (role: ProjectRole) => ALL.filter((a) => can(role, a));

test("each role can do exactly its part", () => {
  assert.deepEqual(allowed("owner"), ALL);
  assert.deepEqual(allowed("architect"), ["view", "comment", "edit", "invite", "message", "review"]);
  assert.deepEqual(allowed("client"), ["view", "comment", "approve", "message"]);
  assert.deepEqual(allowed("builder"), ["view", "comment", "site", "message"]);
  assert.deepEqual(allowed("viewer"), ["view"]);
});

test("nobody without a role can do anything", () => {
  for (const a of ALL) {
    assert.equal(can(null, a), false);
    assert.equal(can(undefined, a), false);
  }
});

test("only the owner approves for themselves; the architect can't approve their own design", () => {
  assert.equal(can("architect", "approve"), false);
  assert.equal(can("client", "edit"), false);
  assert.equal(can("builder", "edit"), false);
});

test("the owner may invite anyone, an architect only the client, builder or viewers, others nobody", () => {
  // an owner's own project: the owner is the client, so nobody invites one
  assert.deepEqual(invitable("owner"), ["architect", "builder", "viewer"]);
  assert.deepEqual(invitable("architect"), ["builder", "viewer"]);
  // a pro's project: one client, then no more
  assert.deepEqual(invitable("owner", "pro"), ["client", "architect", "builder", "viewer"]);
  assert.deepEqual(invitable("owner", "pro", true), ["architect", "builder", "viewer"]);
  // an architect's own client project doesn't take a second architect; a builder's doesn't take a second builder
  assert.deepEqual(invitable("owner", "pro", false, "architect"), ["client", "builder", "viewer"]);
  assert.deepEqual(invitable("owner", "pro", true, "builder"), ["architect", "viewer"]);
  for (const r of ["client", "builder", "viewer", null] as const) assert.deepEqual(invitable(r), []);
});
