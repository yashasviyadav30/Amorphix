import { test } from "node:test";
import assert from "node:assert/strict";
import { questionCount, voiceProblems } from "./voice.ts";

test("a plain reply passes", () => {
  assert.deepEqual(voiceProblems("Warm oak, low lamps and a lot of books. Who else lives with you?"), []);
});

test("banned words are caught in any form", () => {
  assert.deepEqual(voiceProblems("Let's delve into it."), ["banned word: delve"]);
  assert.deepEqual(voiceProblems("We leveraged the light."), ["banned word: leverage"]);
  assert.deepEqual(voiceProblems("A robust, seamless plan."), ["banned word: robust", "banned word: seamless"]);
});

test("words that merely contain a banned word are fine", () => {
  assert.deepEqual(voiceProblems("The journeyman fostered nothing; navigation lights"), ["banned word: foster"]);
  assert.deepEqual(voiceProblems("A curated shelf"), ["banned word: curate"]);
  assert.deepEqual(voiceProblems("Cruciality and robustness"), []);
});

test("stock openers and closers are caught", () => {
  assert.deepEqual(voiceProblems("Great question! The kitchen faces south."), ["preamble opener"]);
  assert.deepEqual(voiceProblems("Absolutely, here it is."), ["preamble opener"]);
  assert.deepEqual(voiceProblems("Here is the plan. I hope this helps!"), ["stock closer"]);
});

test("one em-dash per 200 words is the budget", () => {
  assert.deepEqual(voiceProblems("Oak floors — warm light."), []);
  assert.deepEqual(voiceProblems("Oak — warm — light."), ["too many em-dashes: 2"]);
});

test("praise of the user or project is caught", () => {
  assert.deepEqual(voiceProblems("A new house in Austin sounds like a wonderful project."), ["praise"]);
  assert.deepEqual(voiceProblems("40 by 60 is a great footprint to work with."), ["praise"]);
  assert.deepEqual(voiceProblems("Sounds lovely! Who lives there?"), ["praise"]);
  assert.deepEqual(voiceProblems("I love that. Who lives there?"), ["praise"]);
  assert.deepEqual(voiceProblems("A great room needs good light. Which way does the lot face?"), []);
});

test("questions are counted", () => {
  assert.equal(questionCount("Who lives there?"), 1);
  assert.equal(questionCount("Who lives there, and what is your morning like?"), 1);
  assert.equal(questionCount("How old are the kids? What does the dog need?"), 2);
  assert.equal(questionCount("Noted."), 0);
});
