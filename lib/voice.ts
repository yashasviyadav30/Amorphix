// How every Amorphix agent writes to people, and a checker the evals run on every reply.

export const VOICE_RULES = `# Voice

Write like a good architect talking to a client: plain, warm, specific.

- Start with the point. No opener such as "Great question", "Certainly", "Absolutely" or "I'd be happy to".
- Don't praise the user's answer. React to what it means for the design instead.
- No closer such as "I hope this helps", "Let me know if you have any questions" or "Feel free to ask".
- Short words over long ones: use, help, before, about, start. Never: delve, tapestry, navigate, leverage, landscape, ecosystem, realm, multifaceted, paramount, crucial, robust, comprehensive, nuanced, intricate, foster, underscore, pivotal, holistic, facilitate, utilize, seamless, elevate, curate, journey.
- Concrete over abstract: "oak floors and low warm lamps", not "a cohesive aesthetic".
- Active voice. Name who does what.
- At most one dash-style aside per reply; use commas and full stops instead.
- Mix short sentences with longer ones.
- One hedge at most per claim. Never "could potentially".
- Lists only when the content is a real list, and only as long as the content.
`;

const BANNED_WORDS = [
  "delve", "tapestry", "navigate", "leverage", "landscape", "ecosystem", "realm", "multifaceted", "paramount",
  "crucial", "robust", "comprehensive", "nuanced", "intricate", "foster", "underscore", "pivotal", "holistic",
  "facilitate", "utilize", "utilise", "seamless", "elevate", "curate", "journey",
];
const OPENERS = [/^\s*(great|good|excellent|what a (great|thoughtful|wonderful)) (question|point|choice|answer)/i, /^\s*(certainly|absolutely|of course)[!,.]/i, /^\s*i'?d be (happy|glad) to/i];
const PRAISE = /\b(wonderful|amazing|fantastic|lovely|great|beautiful|exciting) (project|idea|choice|footprint|space|plan|start)\b|\bsounds (like (a |an )?)?(wonderful|lovely|amazing|great|exciting|fantastic)\b|\bi love (that|this)\b|^\s*love (that|this)\b/i;
const CLOSERS = [/i hope (this|that) helps/i, /let me know if you have any questions/i, /feel free to (ask|reach out)/i, /in conclusion/i];

// Problems in one reply, as short labels. Empty means the reply reads clean.
export function voiceProblems(text: string): string[] {
  const problems: string[] = [];
  for (const w of BANNED_WORDS) if (new RegExp(`\\b${w}(s|d|ing|ed)?\\b`, "i").test(text)) problems.push(`banned word: ${w}`);
  if (OPENERS.some((r) => r.test(text))) problems.push("preamble opener");
  if (CLOSERS.some((r) => r.test(text))) problems.push("stock closer");
  if (PRAISE.test(text)) problems.push("praise");
  const dashes = (text.match(/—/g) ?? []).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (dashes > Math.max(1, Math.floor(words / 200))) problems.push(`too many em-dashes: ${dashes}`);
  return problems;
}

// How many questions a reply asks. Interviewer replies should ask exactly one.
export const questionCount = (text: string) => (text.match(/\?/g) ?? []).length;
