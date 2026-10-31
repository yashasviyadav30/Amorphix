import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "A user writing in Hindi (Devanagari) gets the reply in Hindi, in Devanagari.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    await session.send("मुझे पुणे में अपना घर डिज़ाइन करवाना है, प्लॉट 30 बाई 40 फ़ुट का है।");
    t.succeeded();
    t.judge("The reply is written in Hindi using Devanagari script (a few English words like brand names are fine), and asks one question.").atLeast(0.7);
  },
});
