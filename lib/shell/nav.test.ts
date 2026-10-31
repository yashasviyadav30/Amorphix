import { test } from "node:test";
import assert from "node:assert/strict";
import { activeId, projectTools, roleGroups, type NavProject } from "./nav.ts";

const roleTools = (...a: Parameters<typeof roleGroups>) => roleGroups(...a).flatMap((g) => g.items);

const counts = { waits: 2, requests: 1, live: 3, fees: 1, unread: 5 };
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const p = (over: Partial<NavProject> = {}): NavProject => ({ id: "p1", role: "owner", status: "ready", mode: "owner", chosen: true, toured: true, unlocked: true, unread: 0, ...over });

test("each role gets its own tools, named as its home", () => {
  assert.equal(roleTools("owner", counts)[0].label, "My spaces");
  assert.equal(roleTools("architect", counts)[0].label, "Studio");
  assert.equal(roleTools("builder", counts)[0].label, "Sites");
  assert.ok(ids(roleTools("architect", counts)).includes("pipeline"));
  assert.ok(ids(roleTools("builder", counts)).includes("today"));
  assert.ok(!ids(roleTools("owner", counts)).includes("requests"), "owners don't get requests from clients");
  assert.equal(roleTools("builder", counts).find((t) => t.id === "today")?.count, 3);
  assert.equal(roleTools("owner", counts).find((t) => t.id === "inbox")?.count, 5);
});

test("pros get their public profile once their id is known; owners never do", () => {
  assert.equal(roleTools("architect", counts, null, "u1").find((t) => t.id === "profile")?.href, "/pros/u1");
  assert.ok(!ids(roleTools("architect", counts)).includes("profile"));
  assert.ok(!ids(roleTools("owner", counts, null, "u1")).includes("profile"));
});

test("every role's tools have unique ids, so one is lit at a time", () => {
  for (const r of ["owner", "architect", "builder"] as const) {
    const t = ids(roleTools(r, counts, null, "u1"));
    assert.equal(new Set(t).size, t.length, r);
  }
});

test("whoever runs a site gets the crew, deliveries and site money; other owners don't", () => {
  for (const id of ["crew", "deliveries", "money"]) {
    assert.ok(ids(roleTools("builder", counts)).includes(id), id);
    assert.ok(!ids(roleTools("owner", counts)).includes(id), id);
    assert.ok(ids(roleTools("owner", { ...counts, runs: 1 })).includes(id), id);
    assert.ok(!ids(roleTools("architect", counts)).includes(id), id);
  }
});

test("the home link keeps the project last opened", () => {
  assert.equal(roleTools("owner", counts, "abc")[0].href, "/home?p=abc");
  assert.equal(roleTools("owner", counts)[0].href, "/home");
});

test("a project still waiting for its answers offers only its overview", () => {
  assert.deepEqual(ids(projectTools(p({ status: "interview" }))), ["overview"]);
});

test("parts that need a chosen plan wait for one", () => {
  const t = ids(projectTools(p({ chosen: false })));
  assert.ok(t.includes("plans"));
  for (const id of ["walkthrough", "workspace", "budget", "shop", "drawings"]) assert.ok(!t.includes(id), id);
});

test("an owner still on the guided tour gets its steps, not the home's tabs", () => {
  const t = ids(projectTools(p({ toured: false })));
  assert.ok(!t.includes("overview") && !t.includes("thread") && !t.includes("site"));
  assert.ok(t.includes("brief") && t.includes("walkthrough"));
  assert.ok(!ids(projectTools(p({ toured: false, unlocked: false }))).includes("workspace"), "no blank Make changes on the tour");
});

test("viewers and clients see only what they can use", () => {
  const viewer = ids(projectTools(p({ role: "viewer" })));
  for (const id of ["workspace", "site", "budget", "drawings", "team"]) assert.ok(!viewer.includes(id), id);
  const client = ids(projectTools(p({ role: "client" })));
  assert.ok(!client.includes("workspace"));
  assert.ok(client.includes("thread") && client.includes("site"));
});

test("the thread carries its unread count", () => {
  assert.equal(projectTools(p({ unread: 4 })).find((t) => t.id === "thread")?.count, 4);
});

test("the active item follows the URL", () => {
  const q = (s: string) => new URLSearchParams(s);
  assert.equal(activeId("/home", q("")), "home");
  assert.equal(activeId("/home", q("view=pipeline")), "pipeline");
  assert.equal(activeId("/project/x", q("step=plans")), "plans");
  assert.equal(activeId("/project/x", q("tab=thread")), "thread");
  assert.equal(activeId("/project/x", q("")), "overview");
});
