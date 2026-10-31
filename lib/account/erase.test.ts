import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFolder } from "./erase.ts";

// A storage folder in memory that lists at most `limit` files, as the real one does.
function fakeBucket(files: string[]) {
  const left = new Set(files);
  return {
    left,
    list: async (prefix: string, { limit }: { limit: number; offset: number }) => ({
      data: [...left].filter((f) => f.startsWith(`${prefix}/`)).slice(0, limit).map((f) => ({ name: f.slice(prefix.length + 1) })),
      error: null,
    }),
    remove: async (paths: string[]) => {
      paths.forEach((p) => left.delete(p));
      return { error: null };
    },
  };
}

test("empties a folder larger than one page, and only that folder", async () => {
  const b = fakeBucket([...Array.from({ length: 230 }, (_, i) => `p1/f${i}.jpg`), "p2/keep.jpg"]);
  assert.equal(await emptyFolder(b, "p1"), 230);
  assert.deepEqual([...b.left], ["p2/keep.jpg"]);
});

test("an empty folder is fine", async () => {
  assert.equal(await emptyFolder(fakeBucket([]), "nobody"), 0);
});
