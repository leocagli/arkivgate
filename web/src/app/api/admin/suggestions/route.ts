import { getAdminSession } from "@/lib/admin-session";
import { listSuggestions, sortSuggestionsForReview } from "@/lib/suggestions-server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const suggestions = sortSuggestionsForReview(await listSuggestions(session.orgId));

  return Response.json({ suggestions });
}
