import { supabaseAdmin } from "../supabase/admin.ts";

// Deleting for good: a project with everything on it, or a whole account. The database removes what hangs off a
// project (versions, thread, team, site, fees) by itself; files in storage are removed here.

type Bucket = {
  list: (prefix: string, opts: { limit: number; offset: number }) => Promise<{ data: { name: string }[] | null; error: unknown }>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
};

/** Removes every file in one folder of a storage bucket, a page at a time. Returns how many went. */
export async function emptyFolder(bucket: Bucket, folder: string): Promise<number> {
  let gone = 0;
  for (;;) {
    // always the first page: each removal shifts the rest up
    const { data, error } = await bucket.list(folder, { limit: 100, offset: 0 });
    if (error) throw error;
    if (!data?.length) return gone;
    const { error: removeError } = await bucket.remove(data.map((f) => `${folder}/${f.name}`));
    if (removeError) throw removeError;
    gone += data.length;
    if (data.length < 100) return gone;
  }
}

const bucket = (name: string) => supabaseAdmin().storage.from(name) as unknown as Bucket;

/** Deletes a project, its files and everything on it. */
export async function deleteProject(id: string) {
  await emptyFolder(bucket("thread"), id);
  const { error } = await supabaseAdmin().from("projects").delete().eq("id", id);
  if (error) throw error;
}

/** Deletes an account: the projects it owns, its logo, its profile and memberships, then the sign-in itself. */
export async function deleteAccount(userId: string) {
  const db = supabaseAdmin();
  const { data: owned, error } = await db.from("projects").select("id").eq("owner_id", userId);
  if (error) throw error;
  for (const p of owned ?? []) await deleteProject(p.id);
  await emptyFolder(bucket("logos"), userId);
  // the profile, memberships, crew and notifications go with the user
  const { error: authError } = await db.auth.admin.deleteUser(userId);
  if (authError) throw authError;
}
