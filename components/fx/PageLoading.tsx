"use client";

import { Scanning } from "./Motion";

/** The loading state for a whole page: the scan line and the processing sound, never a blank screen. */
export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <main data-page-loading className="grid flex-1 place-items-center py-24">
      <Scanning label={label} />
    </main>
  );
}
