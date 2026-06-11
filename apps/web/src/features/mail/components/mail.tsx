"use client";

import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import * as React from "react";

import { Input } from "@code-main/ui/components/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@code-main/ui/components/resizable";
import { Separator } from "@code-main/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@code-main/ui/components/tabs";
import { cn } from "@code-main/ui/lib/utils";

import { AccountSwitcher } from "@/features/mail/components/account-switcher";
import { AskAIPanel } from "@/features/mail/components/ask-ai-panel";
import { mails, type Mail as MailItem } from "@/features/mail/components/mail-data";
import { MailDisplay } from "@/features/mail/components/mail-display";
import {
  createMailLayout,
  defaultMailLayout,
  mailPanelIds,
  type MailLayout,
} from "@/features/mail/components/mail-layout";
import { MailList } from "@/features/mail/components/mail-list";
import { Nav } from "@/features/mail/components/nav";
import { ModeToggle } from "@/shared/components/mode-toggle";

const primaryLinks = [
  { title: "Inbox", label: "128", icon: Inbox, variant: "default" },
  { title: "Drafts", label: "9", icon: File, variant: "ghost" },
  { title: "Sent", label: "", icon: Send, variant: "ghost" },
  { title: "Junk", label: "23", icon: ArchiveX, variant: "ghost" },
  { title: "Trash", label: "", icon: Trash2, variant: "ghost" },
  { title: "Archive", label: "", icon: Archive, variant: "ghost" },
] as const;

const categoryLinks = [
  { title: "Social", label: "972", icon: Users2, variant: "ghost" },
  { title: "Updates", label: "342", icon: AlertCircle, variant: "ghost" },
  { title: "Forums", label: "128", icon: MessagesSquare, variant: "ghost" },
  { title: "Shopping", label: "8", icon: ShoppingCart, variant: "ghost" },
  { title: "Promotions", label: "21", icon: Archive, variant: "ghost" },
] as const;

export function Mail({
  defaultCollapsed = false,
  defaultLayout = defaultMailLayout,
  navCollapsedSize = 4,
}: {
  readonly defaultCollapsed?: boolean;
  readonly defaultLayout?: MailLayout;
  readonly navCollapsedSize?: number;
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [selected, setSelected] = React.useState<MailItem["id"] | null>(mails[0].id);
  const [isAiOpen, setIsAiOpen] = React.useState(false);
  const layout = createMailLayout(defaultLayout);
  const unreadMails = mails.filter(isUnreadMail);

  return (
    <div className="flex h-full">
    <ResizablePanelGroup
      className="h-full flex-1 items-stretch"
      defaultLayout={layout}
      onLayoutChanged={persistMailLayout}
      orientation="horizontal"
    >
      <MailSidebarPanel
        defaultSize={layout[mailPanelIds.sidebar]}
        isCollapsed={isCollapsed}
        navCollapsedSize={navCollapsedSize}
        onCollapsedChange={setIsCollapsed}
      />
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={toPercent(layout[mailPanelIds.list])}
        id={mailPanelIds.list}
        minSize="30%"
      >
        <Tabs className="flex h-full min-h-0 flex-col" defaultValue="all">
          <div className="flex items-center px-4 py-2">
            <h1 className="text-xl font-bold">Inbox</h1>
            <TabsList className="ml-auto">
              <TabsTrigger className="text-zinc-600 dark:text-zinc-200" value="all">
                All mail
              </TabsTrigger>
              <TabsTrigger className="text-zinc-600 dark:text-zinc-200" value="unread">
                Unread
              </TabsTrigger>
            </TabsList>
            <button
              className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => setIsAiOpen((v) => !v)}
              type="button"
            >
              <Sparkles className="size-3.5" />
              Ask AI
            </button>
          </div>
          <Separator />
          <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="relative">
              <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
              <Input aria-label="Search mail" className="pl-8" placeholder="Search" />
            </div>
          </div>
          <TabsContent className="m-0 min-h-0 flex-1" value="all">
            <MailList items={mails} onSelect={setSelected} selected={selected} />
          </TabsContent>
          <TabsContent className="m-0 min-h-0 flex-1" value="unread">
            <MailList items={unreadMails} onSelect={setSelected} selected={selected} />
          </TabsContent>
        </Tabs>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={toPercent(layout[mailPanelIds.detail])}
        id={mailPanelIds.detail}
        minSize="340px"
      >
        <MailDisplay mail={mails.find((item) => item.id === selected) ?? null} />
      </ResizablePanel>
    </ResizablePanelGroup>
    <AskAIPanel isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}

function MailSidebarPanel({
  defaultSize,
  isCollapsed,
  navCollapsedSize,
  onCollapsedChange,
}: {
  readonly defaultSize: number | undefined;
  readonly isCollapsed: boolean;
  readonly navCollapsedSize: number;
  readonly onCollapsedChange: (isCollapsed: boolean) => void;
}) {
  return (
    <ResizablePanel
      className={cn(isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
      collapsedSize={toPercent(navCollapsedSize)}
      collapsible={true}
      defaultSize={toPercent(defaultSize ?? navCollapsedSize)}
      id={mailPanelIds.sidebar}
      maxSize="20%"
      minSize="15%"
      onResize={(size) => {
        onCollapsedChange(size.asPercentage <= navCollapsedSize + 0.5);
      }}
    >
      <div className={sidebarHeaderClassName(isCollapsed)}>
        <AccountSwitcher isCollapsed={isCollapsed} />
      </div>
      <Separator />
      <Nav isCollapsed={isCollapsed} links={primaryLinks} />
      <Separator />
      <Nav isCollapsed={isCollapsed} links={categoryLinks} />
      <div className="mt-auto flex justify-center p-2">
        <ModeToggle />
      </div>
    </ResizablePanel>
  );
}

function isUnreadMail(item: MailItem) {
  return !item.read;
}

function persistMailLayout(sizes: MailLayout) {
  document.cookie = `react-resizable-panels:layout:mail=${encodeURIComponent(
    JSON.stringify(createMailLayout(sizes)),
  )}; path=/; SameSite=Lax`;
}

function sidebarHeaderClassName(isCollapsed: boolean) {
  return cn("flex h-[52px] items-center justify-center", !isCollapsed && "px-2");
}

function toPercent(size: number) {
  return `${size}%`;
}
