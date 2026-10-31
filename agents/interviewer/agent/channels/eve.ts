import { localDev, type AuthFn } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { GUEST_COOKIE, readCookie, verifyGuest } from "../../../../lib/auth/guest.ts";

// Browsers reach the agent with Amorphix's signed guest cookie, set by the web app.
const amorphixGuest: AuthFn<Request> = async (request) => {
  const id = await verifyGuest(readCookie(request.headers.get("cookie"), GUEST_COOKIE), process.env.AMORPHIX_SESSION_SECRET ?? "");
  return id ? { attributes: {}, authenticator: "amorphix-guest", principalId: id, principalType: "user" as const } : null;
};

// Local development only (eve dev / vercel dev): evals may replace tools with stubs.
const local = localDev();
const localWithStubs: AuthFn<Request> = async (request) => {
  const caller = await local(request);
  return caller ? { ...caller, allowToolStubs: true } : null;
};

export default eveChannel({ auth: [amorphixGuest, localWithStubs] });
