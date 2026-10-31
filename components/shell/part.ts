// Opening one part of a project (?step=plans, ?tab=thread) from anywhere: the sidebar, the bell, Ctrl+K. On the
// project already open, the page is also told directly, because a URL it rewrote itself doesn't reach it as a change.

/** Call after (or alongside) navigating to `href`. */
export function announcePart(href: string) {
  const [path, query] = href.split("?");
  if (query && path === location.pathname) window.dispatchEvent(new CustomEvent("amorphix:part", { detail: query }));
}

/** Navigate to `href` and announce it. */
export function openPart(router: { push: (href: string) => void }, href: string) {
  router.push(href);
  announcePart(href);
}
