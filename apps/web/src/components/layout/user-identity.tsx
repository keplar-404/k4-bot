import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** The user's avatar, name and email, as the sidebar shows them. */
export function UserIdentity({
  name,
  email,
  avatar,
}: {
  name: string;
  email: string;
  avatar: string;
}) {
  return (
    <>
      <Avatar>
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs">{email}</span>
      </div>
    </>
  );
}
