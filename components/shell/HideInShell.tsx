"use client";

import type { ReactNode } from "react";
import { useInShell } from "./AppShell";

/** Shows its children only outside the signed-in app (the sidebar already has what they offer). */
export function HideInShell({ children }: { children: ReactNode }) {
  return useInShell() ? null : children;
}
