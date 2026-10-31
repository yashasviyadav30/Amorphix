// CLIP in the browser: photos and short descriptions become vectors on the person's own device, so a photo never
// leaves it. The model downloads once (the browser caches it) and is shared by every call on the page.
// Browser only: import it from client components.

export const MODEL = "Xenova/clip-vit-base-patch32";

type Progress = (loaded: number) => void; // 0..1 while the model downloads

type T = typeof import("@huggingface/transformers");
let lib: Promise<T> | null = null;
const load = () => (lib ??= import("@huggingface/transformers"));

let vision: Promise<{ processor: Awaited<ReturnType<T["AutoProcessor"]["from_pretrained"]>>; model: Awaited<ReturnType<T["CLIPVisionModelWithProjection"]["from_pretrained"]>> }> | null = null;
let text: Promise<{ tokenizer: Awaited<ReturnType<T["AutoTokenizer"]["from_pretrained"]>>; model: Awaited<ReturnType<T["CLIPTextModelWithProjection"]["from_pretrained"]>> }> | null = null;

// Files download in parts; the overall share of bytes so far.
function tracker(onProgress?: Progress) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (!onProgress || !p.file || p.status !== "progress") return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
    const all = [...files.values()];
    const total = all.reduce((s, f) => s + f.total, 0);
    onProgress(total ? all.reduce((s, f) => s + f.loaded, 0) / total : 0);
  };
}

const unit = (v: number[]) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

export async function embedImages(files: Blob[], onProgress?: Progress): Promise<number[][]> {
  const t = await load();
  vision ??= (async () => {
    const progress_callback = tracker(onProgress);
    const [processor, model] = await Promise.all([
      t.AutoProcessor.from_pretrained(MODEL, { progress_callback }),
      t.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: "q8", progress_callback }),
    ]);
    return { processor, model };
  })();
  const { processor, model } = await vision;
  const out: number[][] = [];
  for (const f of files) {
    const image = await t.RawImage.fromBlob(f);
    const { image_embeds } = await model(await processor(image));
    out.push(unit((image_embeds.tolist() as number[][])[0]));
  }
  return out;
}

export async function embedTexts(texts: string[], onProgress?: Progress): Promise<number[][]> {
  if (!texts.length) return [];
  const t = await load();
  text ??= (async () => {
    const progress_callback = tracker(onProgress);
    const [tokenizer, model] = await Promise.all([
      t.AutoTokenizer.from_pretrained(MODEL, { progress_callback }),
      t.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "q8", progress_callback }),
    ]);
    return { tokenizer, model };
  })();
  const { tokenizer, model } = await text;
  const { text_embeds } = await model(tokenizer(texts, { padding: true, truncation: true }));
  return (text_embeds.tolist() as number[][]).map(unit);
}
