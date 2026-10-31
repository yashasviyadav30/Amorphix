import { test } from "node:test";
import assert from "node:assert/strict";
import { emailProblem } from "./email.ts";

const none = async () => {
  throw Object.assign(new Error("nope"), { code: "ENOTFOUND" });
};
const some = async () => [{ exchange: "mx.example.org", priority: 10 }];
const flaky = async () => {
  throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
};

test("a domain with mail servers is fine", async () => {
  assert.equal(await emailProblem("vicky@example.org", some, none), null);
});

test("a made-up domain is refused, with the domain named", async () => {
  assert.match((await emailProblem("someone@qwzxkjhq.com", none, none))!, /qwzxkjhq\.com/);
});

test("throwaway inboxes and broken addresses are refused", async () => {
  assert.ok(await emailProblem("a@mailinator.com", some, some));
  assert.ok(await emailProblem("not an email", some, some));
  assert.ok(await emailProblem("a@b", some, some));
});

test("a lookup that fails for another reason doesn't block sign-up", async () => {
  assert.equal(await emailProblem("a@example.org", flaky, flaky), null);
});
