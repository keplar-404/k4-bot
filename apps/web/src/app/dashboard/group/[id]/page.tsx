import { Suspense } from "react";
import { GroupChatPage } from "@/features/groups/group-chat-page";

// useParams is runtime data: with Cache Components it must sit inside Suspense.
export default function Page() {
  return (
    <Suspense>
      <GroupChatPage />
    </Suspense>
  );
}
