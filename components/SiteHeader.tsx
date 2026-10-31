import { HomeLink } from "./landing/Intro";
import { Logo } from "./Logo";
import { ProfileMenu } from "./ProfileMenu";
import { NotificationBell } from "./NotificationBell";
import { InstallApp } from "./InstallApp";
import { CommandPalette } from "./CommandPalette";
import { HideInShell } from "./shell/HideInShell";

// The header on public pages and for guests. Inside the signed-in app the sidebar carries all of it.
export function SiteHeader() {
  return (
    <HideInShell>
    <header className="flex items-center justify-between px-4 py-5 sm:px-8">
      <HomeLink>
        <Logo size={26} />
      </HomeLink>
      <div className="flex items-center gap-2">
        <CommandPalette />
        <InstallApp />
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
    </HideInShell>
  );
}
