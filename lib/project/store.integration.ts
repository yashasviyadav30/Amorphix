// Integration test against the real Supabase project. Creates a throwaway project and deletes it.
// Run: npm run test:integration
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { place } from "../layout/place.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import {
  addTasteSignals, bindSession, createProject, deleteProject, getProject, latestVersion,
  projectForSession, saveInterview, saveVersion, updateProject,
} from "./store.ts";

const p = await createProject({ space_type: "apartment", title: "integration test" });
after(() => deleteProject(p.id));

test("a new project starts in the interview with empty fields", () => {
  assert.equal(p.status, "interview");
  assert.deepEqual(p.taste_signals, []);
  assert.deepEqual(p.interview, {});
});

test("interview answers merge by section", async () => {
  await saveInterview(p.id, "people", { adults: 2 });
  await saveInterview(p.id, "people", { pets: "dog" });
  await saveInterview(p.id, "needs", { bedrooms: 2 });
  const got = await getProject(p.id);
  assert.deepEqual(got.interview, { people: { adults: 2, pets: "dog" }, needs: { bedrooms: 2 } });
});

test("taste signals are added once each", async () => {
  await addTasteSignals(p.id, [{ entityId: "e1", name: "One", layer: 1 }]);
  await addTasteSignals(p.id, [{ entityId: "e1", name: "One", layer: 1 }, { entityId: "e2", name: "Two", layer: 3 }]);
  assert.deepEqual((await getProject(p.id)).taste_signals.map((s) => s.entityId), ["e1", "e2"]);
});

test("a session resolves to its project", async () => {
  await bindSession(`test-${p.id}`, p.id, "interviewer");
  assert.equal((await projectForSession(`test-${p.id}`)).id, p.id);
  await assert.rejects(projectForSession("no-such-session"), /not linked/);
});

test("versions count up and the latest comes back", async () => {
  const layout = place(TEMPLATES.apartment, DEFAULT_SHELLS.apartment);
  assert.equal(await saveVersion(p.id, layout, "first"), 1);
  assert.equal(await saveVersion(p.id, layout, "second"), 2);
  const latest = await latestVersion(p.id);
  assert.equal(latest?.version, 2);
  assert.equal(latest?.layout.floors[0].spaces.length, layout.floors[0].spaces.length);
});

test("status only accepts known values", async () => {
  await assert.rejects(updateProject(p.id, { status: "nope" as never }), /check constraint/);
});

test("only the guest who started a project owns it", async () => {
  const { ownsProject } = await import("./store.ts");
  const mine = { owner_id: null, guest_id: "g1" };
  assert.equal(ownsProject(mine, { guestId: "g1" }), true);
  assert.equal(ownsProject(mine, { guestId: "g2" }), false);
  assert.equal(ownsProject(mine, {}), false);
  assert.equal(ownsProject({ owner_id: "u1", guest_id: null }, { userId: "u1" }), true);
  assert.equal(ownsProject({ owner_id: null, guest_id: null }, { guestId: null, userId: null }), false);
  assert.equal(ownsProject({ owner_id: "u1", guest_id: "g1" }, { guestId: "g1" }), false); // owned: the old guest cookie no longer opens it
});
