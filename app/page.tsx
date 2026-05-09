import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const meResponse = await fetchCurrentUser(session);
  redirect("error" in meResponse ? "/login" : "/submit");
}
