import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { questionCount, voiceProblems } from "../../../lib/voice.ts";
import { aceHotelTaste, quietTools } from "./fixtures.ts";

export default defineEval({
  description: "Replies are plain: no technical words, no AI tics, no stock openers or closers.",
  async test(t) {
    const session = await t.session({ stubs: [...quietTools, ...aceHotelTaste] });
    const turn = await session.send("I love the Ace Hotel in New York.");
    turn.expectOk();
    t.check(turn.message, satisfies((m) => !/qloo|entity|ent-ace|tool|find_taste|add_taste/i.test(String(m)), "no technical words"));
    t.check(turn.message, satisfies((m) => voiceProblems(String(m)).length === 0, "plain-english voice, no praise"));
    t.check(turn.message, satisfies((m) => questionCount(String(m)) <= 1, "at most one question"));
  },
});
