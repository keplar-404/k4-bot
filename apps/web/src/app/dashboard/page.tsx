import { redirect } from "next/navigation";

// The chat is the dashboard for now.
export default function Page() {
	redirect("/dashboard/chat");
}
