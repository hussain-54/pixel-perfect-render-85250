/**
 * Best-effort notification to the Auth profile linked on students.profile_id.
 * Never trusts a client-supplied recipient; resolves ownership from the student row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export async function notifyLinkedStudent(
  client: Db,
  studentId: string,
  input: {
    title: string;
    body: string;
    linkPath:
      | "/student/dashboard"
      | "/student/documents"
      | "/student/applications"
      | "/student/appointments"
      | "/student/profile"
      | "/student/notifications";
  },
): Promise<void> {
  const { data: stu } = await client
    .from("students")
    .select("profile_id")
    .eq("id", studentId)
    .maybeSingle();
  const profileId = stu?.profile_id?.trim();
  if (!profileId) return;
  await client.from("notifications").insert({
    user_id: profileId,
    title: input.title,
    body: input.body,
    link_path: input.linkPath,
    student_id: studentId,
  });
}
