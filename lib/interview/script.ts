import type { SpaceType } from "../layout/schema.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import type { Site } from "../project/store.ts";
import type { LangId } from "./lang.ts";
import { HOME_TYPES, type Living } from "./living.ts";
import { mergeRunning, type Running } from "./running.ts";
import { siteSizeProblem, toMetres } from "./logic.ts";
import type { SlotId } from "../plan-import/taste.ts";

// The interview as a fixed script: every question, its answers to tap, and the order they come in for each kind
// of space. Nothing here calls a model, so each next question appears at once. The answers become a project in
// exactly the shape the design step reads (the same fields the old agent saved), and the AI only runs after, on
// the design itself.

type Words = Record<LangId, string>;
export type Choice = { value: string; label: Words };
export type Size = { width: number; depth: number; unit: "ft" | "m" } | { typical: true };
export type TastePick = { slot: SlotId; id: string; name: string };
export type Answer = string | string[] | Size | TastePick;
export type Answers = Record<string, Answer>;

export type Question = {
  id: string;
  /** Which part of the progress rail it belongs to: 0 project, 1 people, 2 how it's used, 3 taste, 4 design. */
  stage: number;
  kind: "choice" | "multi" | "size" | "text" | "taste";
  /** A line said before the question; the first one greets them. */
  lead?: Words;
  ask: Words;
  hint?: Words;
  choices?: Choice[];
  /** Questions that can be skipped (text and the extra taste questions): a skip is saved as "". */
  optional?: boolean;
  slot?: SlotId;
  when?: (a: Answers) => boolean;
  /** A multiple pick's choices ticked already, from earlier answers (Home office for someone who works from home). */
  preset?: (a: Answers) => string[];
};

const w = (en: string, hi: string, hinglish: string): Words => ({ en, hi, hinglish });
const c = (value: string, en: string, hi: string, hinglish: string): Choice => ({ value, label: w(en, hi, hinglish) });
const YES_NO = [c("yes", "Yes", "हाँ", "Haan"), c("no", "No", "नहीं", "Nahi")];

const type = (a: Answers) => a.type as SpaceType | undefined;
const isHome = (a: Answers) => HOME_TYPES.has(type(a) ?? "");
const has = (a: Answers, id: string, value: string) => (Array.isArray(a[id]) ? (a[id] as string[]).includes(value) : a[id] === value);

export const QUESTIONS: Question[] = [
  // The project
  {
    id: "type",
    stage: 0,
    kind: "choice",
    lead: w(
      "Hi, I'm Amorphix, your AI architect. Let's bring your dream project to life.",
      "नमस्ते, मैं Amorphix हूँ, आपका AI आर्किटेक्ट। चलिए आपके सपनों के प्रोजेक्ट को हकीकत बनाते हैं।",
      "Hi, main Amorphix hoon, aapka AI architect. Chalo aapke dream project ko reality banate hain.",
    ),
    ask: w("What are we designing together?", "हम साथ में क्या डिज़ाइन कर रहे हैं?", "Hum saath mein kya design karein?"),
    choices: [
      c("house", "A home", "घर", "Ghar"),
      c("apartment", "An apartment", "अपार्टमेंट", "Apartment"),
      c("cafe", "A café or restaurant", "कैफ़े या रेस्टोरेंट", "Café ya restaurant"),
      c("office", "An office", "ऑफ़िस", "Office"),
      c("hotel", "A hotel", "होटल", "Hotel"),
      c("shop", "A shop or showroom", "दुकान या शोरूम", "Shop ya showroom"),
      c("studio", "A studio", "स्टूडियो", "Studio"),
    ],
  },
  {
    id: "build",
    stage: 0,
    kind: "choice",
    ask: w("Is it a new build or a renovation?", "नया बनाना है या पुराने को बदलना है?", "Naya banana hai ya renovation?"),
    choices: [c("new", "New build", "नया निर्माण", "Naya build"), c("reno", "Renovation", "रेनोवेशन", "Renovation")],
  },
  {
    id: "size",
    stage: 0,
    kind: "size",
    ask: w("How big is the plot or floor?", "प्लॉट या फ़्लोर कितना बड़ा है?", "Plot ya floor kitna bada hai?"),
    hint: w("Width by depth, like 40 by 60 ft", "चौड़ाई × गहराई, जैसे 40 × 60 फ़ुट", "Width x depth, jaise 40 x 60 ft"),
  },
  {
    id: "floors",
    stage: 0,
    kind: "choice",
    ask: w("One floor or two?", "एक मंज़िल या दो?", "Ek floor ya do?"),
    choices: [c("1", "One floor", "एक मंज़िल", "Ek floor"), c("2", "Two floors", "दो मंज़िल", "Do floor")],
    when: (a) => type(a) === "house",
  },
  {
    id: "city",
    stage: 0,
    kind: "text",
    ask: w("Which city is it in?", "यह किस शहर में है?", "Yeh kis city mein hai?"),
    hint: w("e.g. Austin, TX, or Brooklyn, NY", "जैसे पुणे, या दिल्ली", "Jaise Pune, ya Austin TX"),
  },

  // The people
  {
    id: "who",
    stage: 1,
    kind: "multi",
    ask: w("Who will live there?", "वहाँ कौन रहेगा?", "Wahan kaun rahega?"),
    choices: [
      c("me", "Me", "मैं", "Main"),
      c("partner", "My partner", "मेरा साथी", "Partner"),
      c("kids", "Kids", "बच्चे", "Bachche"),
      c("elders", "Parents or elders", "माता-पिता या बड़े", "Parents ya bade"),
      c("pets", "Pets", "पालतू जानवर", "Pets"),
      c("friends", "Friends or flatmates", "दोस्त या फ़्लैटमेट", "Dost ya flatmates"),
    ],
    when: isHome,
  },
  {
    id: "kids",
    stage: 1,
    kind: "multi",
    ask: w("How old are the kids?", "बच्चों की उम्र क्या है?", "Bachchon ki age kya hai?"),
    choices: [c("3", "Under 5", "5 से कम", "5 se kam"), c("8", "5 to 12", "5 से 12", "5 se 12"), c("15", "Teenagers", "किशोर", "Teenagers")],
    when: (a) => isHome(a) && has(a, "who", "kids"),
  },
  {
    id: "wfh",
    stage: 1,
    kind: "choice",
    ask: w("Does anyone work from home?", "क्या कोई घर से काम करता है?", "Koi ghar se kaam karta hai?"),
    choices: YES_NO,
    when: isHome,
  },
  {
    id: "guests",
    stage: 1,
    kind: "multi",
    ask: w("Who are your guests or customers?", "आपके मेहमान या ग्राहक कौन हैं?", "Aapke guests ya customers kaun hain?"),
    choices: [
      c("students", "Students", "छात्र", "Students"),
      c("families", "Families", "परिवार", "Families"),
      c("professionals", "Working people", "कामकाजी लोग", "Working log"),
      c("tourists", "Tourists", "पर्यटक", "Tourists"),
      c("locals", "Neighbours", "आस-पास के लोग", "Aas-paas ke log"),
    ],
    when: (a) => ["cafe", "shop", "hotel"].includes(type(a) ?? ""),
  },

  // How it's used: a home
  {
    id: "bedrooms",
    stage: 2,
    kind: "choice",
    ask: w("How many bedrooms?", "कितने बेडरूम?", "Kitne bedroom?"),
    choices: ["1", "2", "3", "4", "5"].map((n) => c(n, n === "5" ? "5 or more" : n, n === "5" ? "5 या ज़्यादा" : n, n === "5" ? "5 ya zyada" : n)),
    when: (a) => type(a) === "house" || type(a) === "apartment",
  },
  {
    id: "extras",
    stage: 2,
    kind: "multi",
    ask: w("Any other rooms you need?", "और कौन से कमरे चाहिए?", "Aur kaunse rooms chahiye?"),
    choices: [
      c("office", "Home office", "होम ऑफ़िस", "Home office"),
      c("guest", "Guest room", "गेस्ट रूम", "Guest room"),
      c("gym", "Gym", "जिम", "Gym"),
      c("media", "Media room", "मीडिया रूम", "Media room"),
      c("prayer", "Prayer room", "पूजा घर", "Pooja ghar"),
      c("none", "None", "कोई नहीं", "Koi nahi"),
    ],
    when: isHome,
    preset: (a) => (a.wfh === "yes" ? ["office"] : []),
  },
  {
    id: "kitchen",
    stage: 2,
    kind: "choice",
    ask: w("Should the kitchen open onto the living area?", "क्या किचन लिविंग एरिया में खुला हो?", "Kitchen living area mein open ho?"),
    choices: [
      c("open", "Open to living", "खुला", "Open"),
      c("semi", "Half open", "आधा खुला", "Half open"),
      c("closed", "Its own room", "अलग कमरा", "Alag room"),
    ],
    when: isHome,
  },
  {
    id: "entertaining",
    stage: 2,
    kind: "choice",
    ask: w("How often do people come over?", "लोग कितनी बार आते हैं?", "Log kitni baar aate hain?"),
    choices: [c("often", "Often", "अक्सर", "Aksar"), c("sometimes", "Sometimes", "कभी-कभी", "Kabhi kabhi"), c("rarely", "Rarely", "बहुत कम", "Bahut kam")],
    when: isHome,
  },
  {
    id: "bedroomsPlace",
    stage: 2,
    kind: "choice",
    ask: w(
      "Bedrooms close together, or the main bedroom apart for quiet?",
      "बेडरूम पास-पास हों, या मुख्य बेडरूम शांति के लिए अलग?",
      "Bedrooms paas paas, ya main bedroom alag quiet ke liye?",
    ),
    choices: [c("together", "Close together", "पास-पास", "Paas paas"), c("apart", "Main one apart", "मुख्य अलग", "Main alag")],
    when: (a) => isHome(a) && type(a) !== "studio" && a.bedrooms !== "1",
  },
  {
    id: "workVisitors",
    stage: 2,
    kind: "choice",
    ask: w("Do clients or colleagues come to the house?", "क्या क्लाइंट या साथी घर आते हैं?", "Clients ya colleagues ghar aate hain?"),
    choices: YES_NO,
    when: (a) => isHome(a) && a.wfh === "yes",
  },
  {
    id: "outlook",
    stage: 2,
    kind: "choice",
    ask: w("Should the living room look onto the garden or the street?", "लिविंग रूम बगीचे की तरफ़ हो या सड़क की?", "Living room garden ki taraf ho ya street ki?"),
    choices: [c("garden", "Garden", "बगीचा", "Garden"), c("street", "Street", "सड़क", "Street"), c("either", "Either", "कोई भी", "Koi bhi")],
    when: isHome,
  },
  {
    id: "dislikes",
    stage: 2,
    kind: "text",
    optional: true,
    ask: w("Anything you dislike about where you are now?", "अभी जहाँ हैं, वहाँ क्या पसंद नहीं?", "Abhi jahan ho, wahan kya pasand nahi?"),
    hint: w("e.g. the kitchen is too dark", "जैसे किचन बहुत अंधेरा है", "Jaise kitchen bahut dark hai"),
    when: isHome,
  },

  // How it's used: a business
  {
    id: "service",
    stage: 2,
    kind: "choice",
    ask: w("Do most customers sit down or take away?", "ज़्यादातर ग्राहक बैठते हैं या ले जाते हैं?", "Zyada customers baithte hain ya le jaate hain?"),
    choices: [c("dine-in", "Sit down", "बैठते हैं", "Baithte hain"), c("takeaway", "Take away", "ले जाते हैं", "Le jaate hain"), c("both", "Both", "दोनों", "Dono")],
    when: (a) => type(a) === "cafe",
  },
  {
    id: "cafeKitchen",
    stage: 2,
    kind: "choice",
    ask: w("Full meals, or coffee and light food?", "पूरा खाना, या कॉफ़ी और हल्का खाना?", "Full meals, ya coffee aur light food?"),
    choices: [c("full", "Full meals", "पूरा खाना", "Full meals"), c("prep", "Coffee and light food", "कॉफ़ी और हल्का खाना", "Coffee aur light food")],
    when: (a) => type(a) === "cafe",
  },
  {
    id: "seats",
    stage: 2,
    kind: "choice",
    ask: w("About how many seats?", "लगभग कितनी सीटें?", "Lagbhag kitni seats?"),
    choices: [c("12", "Up to 15", "15 तक", "15 tak"), c("24", "15 to 30", "15 से 30", "15 se 30"), c("45", "30 to 60", "30 से 60", "30 se 60"), c("80", "More than 60", "60 से ज़्यादा", "60 se zyada")],
    when: (a) => type(a) === "cafe",
  },
  {
    id: "outdoor",
    stage: 2,
    kind: "choice",
    ask: w("Would you like seating outside?", "क्या बाहर बैठने की जगह चाहिए?", "Bahar baithne ki jagah chahiye?"),
    choices: YES_NO,
    when: (a) => type(a) === "cafe",
  },
  {
    id: "people",
    stage: 2,
    kind: "choice",
    ask: w("How many people work there?", "वहाँ कितने लोग काम करते हैं?", "Wahan kitne log kaam karte hain?"),
    choices: [c("8", "Up to 10", "10 तक", "10 tak"), c("18", "10 to 25", "10 से 25", "10 se 25"), c("38", "25 to 50", "25 से 50", "25 se 50"), c("70", "More than 50", "50 से ज़्यादा", "50 se zyada")],
    when: (a) => type(a) === "office",
  },
  {
    id: "work",
    stage: 2,
    kind: "choice",
    ask: w("Is the work mostly focused, or mostly together?", "काम ज़्यादातर ध्यान से अकेले, या मिलकर?", "Kaam zyada focus wala ya saath milke?"),
    choices: [c("focus", "Focused", "ध्यान वाला", "Focus"), c("together", "Together", "मिलकर", "Saath milke"), c("mixed", "A mix", "दोनों", "Dono")],
    when: (a) => type(a) === "office",
  },
  {
    id: "visitors",
    stage: 2,
    kind: "choice",
    ask: w("Do clients come in?", "क्या क्लाइंट आते हैं?", "Clients aate hain?"),
    choices: YES_NO,
    when: (a) => type(a) === "office",
  },
  {
    id: "display",
    stage: 2,
    kind: "choice",
    ask: w(
      "Do customers browse an open floor, or are a few pieces shown off to the street?",
      "ग्राहक खुली जगह में घूमकर देखते हैं, या कुछ चीज़ें सड़क की तरफ़ दिखाई जाती हैं?",
      "Customers ghoom ke dekhte hain, ya kuch pieces street ki taraf dikhte hain?",
    ),
    choices: [c("browse", "Browse an open floor", "घूमकर देखते हैं", "Ghoom ke dekhte hain"), c("showcase", "A few pieces on show", "कुछ चीज़ें दिखाई जाती हैं", "Kuch pieces on show")],
    when: (a) => type(a) === "shop",
  },
  {
    id: "fittingRooms",
    stage: 2,
    kind: "choice",
    ask: w("How many fitting rooms?", "कितने ट्रायल रूम?", "Kitne trial rooms?"),
    choices: [c("0", "None", "कोई नहीं", "Koi nahi"), c("2", "1 or 2", "1 या 2", "1 ya 2"), c("4", "3 or 4", "3 या 4", "3 ya 4"), c("6", "5 or more", "5 या ज़्यादा", "5 ya zyada")],
    when: (a) => type(a) === "shop",
  },
  {
    id: "rooms",
    stage: 2,
    kind: "choice",
    ask: w("How many guest rooms on a floor?", "एक फ़्लोर पर कितने गेस्ट रूम?", "Ek floor pe kitne guest rooms?"),
    choices: [c("6", "Up to 8", "8 तक", "8 tak"), c("12", "8 to 15", "8 से 15", "8 se 15"), c("20", "15 to 25", "15 से 25", "15 se 25"), c("30", "More than 25", "25 से ज़्यादा", "25 se zyada")],
    when: (a) => type(a) === "hotel",
  },

  // Budget
  {
    id: "budget",
    stage: 2,
    kind: "choice",
    ask: w("What kind of budget are you thinking?", "बजट कैसा सोच रहे हैं?", "Budget kaisa soch rahe ho?"),
    choices: [
      c("essential", "Keep it tight", "कम में", "Kam mein"),
      c("mid", "Mid-range", "बीच का", "Mid-range"),
      c("premium", "Premium", "प्रीमियम", "Premium"),
      c("luxury", "Luxury", "लग्ज़री", "Luxury"),
    ],
  },

  // Then the style: a name for each (typed or tapped) and photos, read on the device, after the interview's questions
  {
    id: "place",
    stage: 3,
    kind: "taste",
    slot: "place",
    lead: w("Now let's find your style. Three quick picks.", "अब आपकी स्टाइल ढूँढते हैं। बस तीन चुनाव।", "Ab aapka style dhoondte hain. Bas teen picks."),
    ask: w("Now the fun part. A hotel, café or restaurant you never wanted to leave?", "अब मज़ेदार हिस्सा। कोई होटल, कैफ़े या रेस्टोरेंट जहाँ से जाने का मन न हुआ?", "Ab mazedaar part. Koi hotel, café ya restaurant jahan se jaane ka mann nahi hua?"),
    hint: w("e.g. Ace Hotel New York", "जैसे ताज महल पैलेस मुंबई", "Jaise Ace Hotel New York"),
  },
  {
    id: "brand",
    stage: 3,
    kind: "taste",
    slot: "brand",
    ask: w("A brand whose things you love using?", "कोई ब्रांड जिसकी चीज़ें आपको इस्तेमाल करना पसंद है?", "Koi brand jiski cheezein aapko use karna pasand hai?"),
    hint: w("e.g. Muji", "जैसे Muji", "Jaise Muji"),
  },
  {
    id: "media",
    stage: 3,
    kind: "taste",
    slot: "media",
    ask: w("A film, show or music you could enjoy again and again?", "कोई फ़िल्म, शो या संगीत जो बार-बार देख-सुन सकें?", "Koi film, show ya music jo baar baar dekh sun sako?"),
    hint: w("e.g. Interstellar", "जैसे Interstellar", "Jaise Interstellar"),
  },
];

/** The question to ask next, or null when the interview is complete. */
export function next(a: Answers): Question | null {
  return QUESTIONS.find((q) => (q.when?.(a) ?? true) && a[q.id] === undefined) ?? null;
}

/** The questions that apply to these answers, in order: for the progress rail and for checking. */
export const asked = (a: Answers) => QUESTIONS.filter((q) => q.when?.(a) ?? true);

/** The label of a stored answer in the chosen language, for showing it back in the chat. */
export function labelOf(q: Question, value: Answer, lang: LangId, unitWord = { ft: "ft", m: "m" }): string {
  if (q.kind === "taste") return value === "" ? { en: "Skip", hi: "छोड़ें", hinglish: "Skip" }[lang] : (value as TastePick).name;
  if (q.kind === "size") {
    const s = value as Size;
    return "typical" in s ? { en: "Not sure, use a typical size", hi: "पता नहीं, आम साइज़ लें", hinglish: "Pata nahi, typical size le lo" }[lang] : `${s.width} × ${s.depth} ${unitWord[s.unit]}`;
  }
  const values = Array.isArray(value) ? value : [value as string];
  const words = values.map((v) => q.choices?.find((ch) => ch.value === v)?.label[lang] ?? v);
  return words.join(", ") || { en: "Skip", hi: "छोड़ें", hinglish: "Skip" }[lang];
}

/**
 * Everything wrong with a set of answers, checked against the script: each answer must be one of its question's
 * choices, sizes and text in range, and every question that applies answered. Empty means complete and valid.
 * The finish route runs this, since the browser sends the answers.
 */
export function problems(a: Answers): string[] {
  const out: string[] = [];
  for (const q of asked(a)) {
    const v = a[q.id];
    if (v === undefined) {
      out.push(`unanswered: ${q.id}`);
      continue;
    }
    if (q.kind === "choice" && !(typeof v === "string" && q.choices!.some((ch) => ch.value === v))) out.push(`bad choice: ${q.id}`);
    if (q.kind === "multi" && !(Array.isArray(v) && v.length && v.every((x) => q.choices!.some((ch) => ch.value === x)))) out.push(`bad choices: ${q.id}`);
    if (q.kind === "text" && !(typeof v === "string" && v.length <= 200 && (q.optional || v.trim().length >= 2))) out.push(`bad text: ${q.id}`);
    if (q.kind === "size") {
      const s = v as Size;
      if (!s || typeof s !== "object") out.push(`bad size: ${q.id}`);
      else if (!("typical" in s)) {
        if (!(s.unit === "ft" || s.unit === "m") || !(s.width > 0) || !(s.depth > 0)) out.push(`bad size: ${q.id}`);
        else {
          const p = siteSizeProblem(s.width, s.depth, s.unit);
          if (p) out.push(p);
        }
      }
    }
    if (q.kind === "taste" && !(q.optional && v === "")) {
      const t = v as TastePick;
      if (!t || t.slot !== q.slot || typeof t.id !== "string" || typeof t.name !== "string" || !t.id || !t.name) out.push(`bad pick: ${q.id}`);
    }
  }
  return out;
}

const TYPE_WORD: Record<SpaceType, string> = { house: "house", apartment: "apartment", cafe: "café", office: "office", hotel: "hotel", shop: "shop", studio: "studio" };

/**
 * The project the answers describe, in the shape the design step reads: site in metres, and the interview with
 * the same sections and fields the old agent saved (people, needs, living or running, budget). The taste is added
 * by the finish route from what the device read.
 */
const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const US_CITIES = /\b(new york|brooklyn|manhattan|queens|los angeles|san francisco|chicago|houston|austin|dallas|seattle|portland|boston|miami|atlanta|denver|phoenix|philadelphia|san diego|nashville|detroit|minneapolis|las vegas|washington|silver lake|echo park|oakland|honolulu)\b/i;

/** Feet for a place in the US (or Liberia or Myanmar), metres everywhere else: "Austin, TX", "Brooklyn", "Pune". */
export function usesFeet(city: string): boolean {
  const c = city.trim();
  const last = c.split(",").at(-1)?.trim() ?? "";
  return /\b(usa|u\.s\.a?\.?|united states|america|liberia|myanmar)\b/i.test(c) || US_STATES.includes(last.toUpperCase()) || US_CITIES.test(c);
}

export function toProject(a: Answers, lang: LangId) {
  const spaceType = a.type as SpaceType;
  const size = a.size as Size;
  const shell = "typical" in size ? { ...DEFAULT_SHELLS[spaceType], unit: "m" as const } : { width: toMetres(size.width, size.unit), depth: toMetres(size.depth, size.unit), unit: size.unit };
  const city = String(a.city).trim();
  const site: Site = {
    width: +shell.width.toFixed(2),
    depth: +shell.depth.toFixed(2),
    floors: spaceType === "house" ? Number(a.floors) : TEMPLATES[spaceType].floors,
    location: city,
    // a typical size has no unit of its own: the city decides
    units: ("typical" in size ? usesFeet(city) : shell.unit !== "m") ? "imperial" : "metric",
  };

  const interview: Record<string, unknown> = { project: { newBuild: a.build === "new" }, budget: { level: a.budget }, scripted: true, language: lang };
  const list = (id: string) => (Array.isArray(a[id]) ? (a[id] as string[]) : []);

  if (HOME_TYPES.has(spaceType)) {
    const who = list("who");
    interview.people = {
      who,
      adults: Math.max(1, who.filter((x) => x === "me" || x === "partner").length + (who.includes("elders") ? 2 : 0)),
      kids: list("kids").map(Number),
      pets: who.includes("pets"),
      worksFromHome: a.wfh === "yes",
    };
    const rooms = list("extras").filter((x) => x !== "none");
    interview.needs = { ...(a.bedrooms ? { bedrooms: Number(a.bedrooms) } : {}), ...(rooms.length ? { rooms } : {}) };
    const dislikes = typeof a.dislikes === "string" ? a.dislikes.trim() : "";
    if (dislikes) interview.dislikes = { said: dislikes };
    const living: Living = {
      kitchen: a.kitchen as Living["kitchen"],
      entertaining: a.entertaining as Living["entertaining"],
      // One bedroom, or a studio, has nothing to keep apart.
      bedrooms: (a.bedroomsPlace as Living["bedrooms"]) ?? "together",
      outlook: a.outlook as Living["outlook"],
      ...(a.wfh === "yes" ? { workVisitors: a.workVisitors === "yes" } : {}),
    };
    interview.living = living;
  } else {
    if (a.guests) interview.guests = { who: list("guests") };
    const r: Running = {};
    if (spaceType === "cafe") Object.assign(r, { service: a.service, kitchen: a.cafeKitchen, seats: Number(a.seats), outdoor: a.outdoor === "yes" });
    if (spaceType === "office") Object.assign(r, { people: Number(a.people), work: a.work, visitors: a.visitors === "yes" });
    if (spaceType === "shop") Object.assign(r, { display: a.display, fittingRooms: Number(a.fittingRooms) });
    if (spaceType === "hotel") Object.assign(r, { rooms: Number(a.rooms) });
    interview.running = mergeRunning({}, r);
  }

  const title = `The ${city.split(",")[0].trim()} ${TYPE_WORD[spaceType]}`;
  return { space_type: spaceType, site, interview, title };
}

/** The required taste picks (a place, a brand, a film or music), then any extras they gave, for Amorphix to confirm. */
export const picksOf = (a: Answers): TastePick[] =>
  QUESTIONS.filter((q) => q.kind === "taste")
    .map((q) => a[q.id])
    .filter((v): v is TastePick => !!v && typeof v === "object" && "slot" in v);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();

/**
 * The choices a typed or spoken answer names, in any of the three languages: "haan", "yes" and "हाँ" all pick yes.
 * A number picks the nearest choice when the choices are numbers ("about 40 seats" picks 30 to 60). Empty when
 * nothing matches, so the screen can ask them to tap instead.
 */
export function matchChoices(text: string, q: Question): string[] {
  const t = ` ${norm(text)} `;
  if (!q.choices || t.trim() === "") return [];
  const hits = q.choices
    .filter((ch) =>
      [...Object.values(ch.label), ch.value].some((l) => {
        const n = norm(l);
        return n !== "" && (t.includes(` ${n} `) || (n.length > 3 && t.includes(n)));
      }),
    )
    .map((ch) => ch.value);
  if (hits.length) return q.kind === "choice" ? hits.slice(0, 1) : hits;
  const said = t.match(/\d+/);
  const numbers = q.choices.map((ch) => Number(ch.value));
  if (said && numbers.every((n) => Number.isFinite(n))) {
    const n = Number(said[0]);
    return [q.choices[numbers.reduce((best, v, i) => (Math.abs(v - n) < Math.abs(numbers[best] - n) ? i : best), 0)].value];
  }
  return [];
}
