// Before an account is made: is this an address that can receive mail at all? The domain must take mail (it has
// mail servers, or at least exists), and throwaway inboxes are refused. Whether the inbox itself exists is only
// proven by the confirmation email.

// The most used throwaway inbox services.
const THROWAWAY = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "temp-mail.org",
  "tempmail.com", "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc", "fakeinbox.com",
  "throwawaymail.com", "mohmal.com", "emailondeck.com", "tempail.com", "mintemail.com", "mailnesia.com", "spamgourmet.com",
]);

const SHAPE = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/i;

type Lookup = (domain: string) => Promise<unknown[]>;

/** Why this address can't be used, in words for the person, or null when it's fine. */
export async function emailProblem(address: string, mx: Lookup, a: Lookup): Promise<string | null> {
  const email = address.trim().toLowerCase();
  if (!SHAPE.test(email)) return "That doesn't look like an email address.";
  const domain = email.split("@")[1];
  if (THROWAWAY.has(domain)) return "Please use an email you keep: throwaway inboxes can't get your project updates.";
  const has = async (look: Lookup) => {
    try {
      return (await look(domain)).length > 0;
    } catch (e) {
      // only "no such domain" or "no records" count as a no; a lookup that failed for another reason lets it through
      const code = (e as { code?: string }).code;
      return code === "ENOTFOUND" || code === "ENODATA" ? false : true;
    }
  };
  if (await has(mx)) return null;
  if (await has(a)) return null;
  return `No email can reach ${domain}. Check the spelling?`;
}
