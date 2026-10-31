// The languages the interview speaks: what Amorphix says first, how the microphone listens, and which voice reads
// replies aloud. The interviewer answers in whatever language the user writes in; this only sets the greeting
// and the speech settings.

export type LangId = "en" | "hi" | "hinglish";

export const LANGS: { id: LangId; label: string; greeting: string; listen: string; voice: string }[] = [
  {
    id: "en",
    label: "English",
    greeting: "Hi, I'm Amorphix. What are we designing together: a home, a hotel, an office, a café, a shop or a studio?",
    listen: "en-IN",
    voice: "en",
  },
  {
    id: "hi",
    label: "हिंदी",
    greeting: "नमस्ते, मैं Amorphix हूँ। हम साथ में क्या डिज़ाइन कर रहे हैं: घर, होटल, ऑफ़िस, कैफ़े, दुकान या स्टूडियो?",
    listen: "hi-IN",
    voice: "hi-IN",
  },
  {
    id: "hinglish",
    label: "Hinglish",
    greeting: "Hi, main Amorphix hoon. Aaj hum kya design karein: ghar, hotel, office, café, shop ya studio?",
    // Indian English recognition keeps Hinglish in Latin letters; a Hindi voice reads Hinglish naturally.
    listen: "en-IN",
    voice: "hi-IN",
  },
];

export const langOf = (id: string | null | undefined) => LANGS.find((l) => l.id === id) ?? LANGS[0];

/** The voice language for a piece of text: Devanagari always reads in Hindi, anything else in the chosen voice. */
export const voiceFor = (text: string, lang: LangId) => (/[ऀ-ॿ]/.test(text) ? "hi-IN" : langOf(lang).voice);

/** Answers to tap at the start, in the chosen language. */
export const STARTERS: Record<LangId, string[]> = {
  en: ["A home", "An apartment", "A café", "An office", "A hotel", "A shop", "A studio"],
  hi: ["घर", "अपार्टमेंट", "कैफ़े", "ऑफ़िस", "होटल", "दुकान", "स्टूडियो"],
  hinglish: ["Ghar", "Apartment", "Café", "Office", "Hotel", "Shop", "Studio"],
};
