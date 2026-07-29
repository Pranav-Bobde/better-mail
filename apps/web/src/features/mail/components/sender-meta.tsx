import { Avatar, AvatarFallback } from "@code-main/ui/components/avatar";

// Sender header shared by the real mail detail pane and the landing demo pane.
// Callers pass display-ready strings (initials, formatted date) so each surface
// keeps its own formatting rules.
export function MailSenderMeta({
  dateText,
  email,
  initials,
  name,
  subject,
}: {
  readonly dateText: string;
  readonly email: string;
  readonly initials: string;
  readonly name: string;
  readonly subject: string;
}) {
  return (
    <div className="flex items-start p-4">
      <div className="flex items-start gap-4 text-sm">
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <div className="font-semibold">{name}</div>
          <div className="line-clamp-1 text-xs">{subject}</div>
          <div className="line-clamp-1 text-xs">
            <span className="font-medium">Reply-To:</span> {email}
          </div>
        </div>
      </div>
      <div className="ml-auto text-xs text-muted-foreground">{dateText}</div>
    </div>
  );
}
