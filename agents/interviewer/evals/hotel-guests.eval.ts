import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "For a hotel, the agent asks about the guests, not a family.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    await session.send("We're building a 40-room boutique hotel in Brooklyn on a 100 by 45 foot lot. Plan one typical floor.");
    const turn = await session.send("Yes, that's right.");
    turn.expectOk();
    t.judge("Across the conversation the agent asks about the hotel's guests or the people who will stay there, not about a family or kids.", {
      on: session.transcript,
    }).atLeast(0.7);
  },
});
