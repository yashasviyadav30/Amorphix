import { test } from "node:test";
import assert from "node:assert/strict";
import { matches } from "./palette.ts";

const items = [
  { label: "The LA house", hint: "Project", href: "/p/1", group: "Projects" },
  { label: "The LA house › Budget", hint: "Budget", href: "/p/1?step=budget", group: "Projects" },
  { label: "Café in New York › Budget", hint: "Budget", href: "/p/2?step=budget", group: "Projects" },
  { label: "Resources and help", hint: "Docs", href: "/resources", group: "Go to" },
];

test("every typed word must match, in any order", () => {
  assert.deepEqual(matches(items, "budget house").map((i) => i.href), ["/p/1?step=budget"]);
  assert.equal(matches(items, "").length, 4);
  assert.deepEqual(matches(items, "docs").map((i) => i.href), ["/resources"]);
});

test("labels that start with the word come first", () => {
  assert.equal(matches(items, "caf")[0].href, "/p/2?step=budget");
});
