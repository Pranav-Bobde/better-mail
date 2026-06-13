import { formatDistanceToNow } from "date-fns";

import { Badge } from "@code-main/ui/components/badge";
import { ScrollArea } from "@code-main/ui/components/scroll-area";
import { cn } from "@code-main/ui/lib/utils";

import type { Mail } from "@/features/mail/components/mail-data";
import { cleanMailPreviewText } from "@/features/mail/components/mail-text";

export function MailList({
  items,
  selected,
  onSelect,
}: {
  readonly items: readonly Mail[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {items.map((item) => (
          <MailListItem
            item={item}
            key={item.id}
            onSelect={onSelect}
            selected={selected === item.id}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function MailListItem({
  item,
  onSelect,
  selected,
}: {
  readonly item: Mail;
  readonly onSelect: (id: string) => void;
  readonly selected: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full min-w-0 flex-col items-start gap-2 overflow-hidden rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
        selected && "bg-muted",
      )}
      aria-pressed={selected}
      onClick={() => onSelect(item.id)}
      type="button"
    >
      <MailListItemHeader item={item} selected={selected} />
      <div className="line-clamp-2 w-full break-words text-xs text-muted-foreground">
        {getPreviewText(item)}
      </div>
      <div className="flex items-center gap-2">
        {item.labels.map((label) => (
          <Badge key={label} variant={getBadgeVariantFromLabel(label)}>
            {label}
          </Badge>
        ))}
      </div>
    </button>
  );
}

function MailListItemHeader({
  item,
  selected,
}: {
  readonly item: Mail;
  readonly selected: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <div className="flex w-full items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate font-semibold">{item.name}</div>
          <span
            className={cn("flex size-2 shrink-0 rounded-full bg-blue-600", item.read && "hidden")}
          />
        </div>
        <div className={cn("ml-auto shrink-0 text-xs", selectedDateClassName(selected))}>
          {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
        </div>
      </div>
      <div className="line-clamp-1 w-full break-words text-xs font-medium">{item.subject}</div>
    </div>
  );
}

function getPreviewText(item: Mail) {
  const source = item.snippet?.trim() ? item.snippet : item.text;
  return cleanMailPreviewText(source).substring(0, 280);
}

function selectedDateClassName(selected: boolean) {
  return selected ? "text-foreground" : "text-muted-foreground";
}

function getBadgeVariantFromLabel(label: string): React.ComponentProps<typeof Badge>["variant"] {
  return badgeVariantsByLabel[label.toLowerCase()] ?? "secondary";
}

const badgeVariantsByLabel: Readonly<
  Record<string, React.ComponentProps<typeof Badge>["variant"]>
> = {
  personal: "outline",
  work: "default",
};
