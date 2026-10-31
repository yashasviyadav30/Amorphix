import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { wrapLanguageModel, type LanguageModel } from "ai";

// One place picks the model for every agent. Switching models is one env var, no code change:
//   AMORPHIX_MODEL="google/gemini-3.5-flash"      (the default)
//   AMORPHIX_MODEL="anthropic/claude-sonnet-5.5"
// Each provider is called directly when its own key is set, otherwise through Vercel AI Gateway.

export type Route = { via: "google" | "anthropic" | "gateway"; model: string };

export function route(env: Record<string, string | undefined> = process.env): Route {
  // An empty value (a copied template) means the default, not a model with no name.
  const id = env.AMORPHIX_MODEL?.trim() || "google/gemini-3.5-flash";
  const [provider, ...rest] = id.split("/");
  const model = rest.join("/");
  if (provider === "google" && env.GOOGLE_GENERATIVE_AI_API_KEY) return { via: "google", model };
  if (provider === "anthropic" && env.ANTHROPIC_API_KEY) return { via: "anthropic", model };
  return { via: "gateway", model: id };
}

// Gemini models to fall back to, in order, when the chosen one is out of quota. Each free-tier model has its own
// daily quota, so a busy day on one (evals, a demo) doesn't stop the interview. AMORPHIX_FALLBACK_MODELS overrides.
const GEMINI_FALLBACKS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];

/**
 * A quota, rate-limit or "too busy right now" error: worth trying another model. Anything else (a bad request, a bad
 * key) is a real failure and is passed on.
 */
export const isQuota = (e: unknown) => {
  const err = e as { statusCode?: number; message?: string } | null;
  return err?.statusCode === 429 || err?.statusCode === 503 || /quota|rate.?limit|resource.?exhausted|429|high demand|overloaded|unavailable/i.test(String(err?.message ?? e));
};

type Model = Exclude<LanguageModel, string>;

/** `primary`, and when it is out of quota, each of `fallbacks` in turn. */
export function withFallback(primary: Model, fallbacks: Model[]): LanguageModel {
  if (!fallbacks.length) return primary;
  const attempt = async <T>(first: () => PromiseLike<T>, rest: (m: Model) => PromiseLike<T>): Promise<T> => {
    try {
      return await first();
    } catch (e) {
      if (!isQuota(e)) throw e;
      let last = e;
      for (const m of fallbacks) {
        try {
          return await rest(m);
        } catch (err) {
          if (!isQuota(err)) throw err;
          last = err;
        }
      }
      throw last;
    }
  };
  return wrapLanguageModel({
    model: primary as Parameters<typeof wrapLanguageModel>[0]["model"],
    middleware: {
      specificationVersion: "v4",
      wrapGenerate: ({ doGenerate, params }) => attempt(doGenerate, (m) => (m as typeof primary & { doGenerate: typeof doGenerate }).doGenerate(params as never) as never),
      wrapStream: ({ doStream, params }) => attempt(doStream, (m) => (m as typeof primary & { doStream: typeof doStream }).doStream(params as never) as never),
    },
  });
}

/**
 * The Gemini models to try, in order. With `tools`, "lite" models go last: they sometimes write a tool call out as
 * text ("tool_code print(default_api...)") instead of making it, which stalls an agent, so they only stand in when
 * every other model is out of quota.
 */
export function geminiOrder(primary: string, tools: boolean, fallbacks = GEMINI_FALLBACKS): string[] {
  const all = [...new Set([primary, ...fallbacks].filter(Boolean))];
  return tools ? [...all.filter((n) => !/lite/i.test(n)), ...all.filter((n) => /lite/i.test(n))] : all;
}

export function chatModel(env: Record<string, string | undefined> = process.env, { tools = false } = {}): LanguageModel {
  const r = route(env);
  if (r.via === "google") {
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    const [first, ...rest] = geminiOrder(r.model, tools, env.AMORPHIX_FALLBACK_MODELS?.split(",").map((x) => x.trim()));
    return withFallback(google(first), rest.map((n) => google(n)));
  }
  if (r.via === "anthropic") return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(r.model);
  return r.model;
}
