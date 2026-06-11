"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@code-main/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@code-main/ui/components/tooltip";
import { cn } from "@code-main/ui/lib/utils";

type NavLink = {
  readonly title: string;
  readonly label?: string;
  readonly icon: LucideIcon;
  readonly variant: "default" | "ghost";
};

export function Nav({
  isCollapsed,
  links,
}: {
  readonly isCollapsed: boolean;
  readonly links: readonly NavLink[];
}) {
  const items = links.map((link) => <CollapsedNavItem key={link.title} link={link} />);

  if (!isCollapsed) {
    return <NavShell isCollapsed={isCollapsed}>{links.map(renderExpandedNavItem)}</NavShell>;
  }

  return <NavShell isCollapsed={isCollapsed}>{items}</NavShell>;
}

function NavShell({
  children,
  isCollapsed,
}: {
  readonly children: React.ReactNode;
  readonly isCollapsed: boolean;
}) {
  return (
    <div
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
      data-collapsed={isCollapsed}
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {children}
      </nav>
    </div>
  );
}

function CollapsedNavItem({ link }: { readonly link: NavLink }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            className={cn(
              buttonVariants({ variant: link.variant, size: "icon" }),
              "size-9",
              getCollapsedActiveClass(link.variant),
            )}
            href="#"
          />
        }
      >
        <link.icon className="size-4" />
        <span className="sr-only">{link.title}</span>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-4" side="right">
        {link.title}
        <span className={cn("ml-auto text-muted-foreground", !link.label && "hidden")}>
          {link.label}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function renderExpandedNavItem(link: NavLink) {
  return <ExpandedNavItem key={link.title} link={link} />;
}

function ExpandedNavItem({ link }: { readonly link: NavLink }) {
  return (
    <Link
      className={cn(
        buttonVariants({ variant: link.variant, size: "sm" }),
        getExpandedActiveClass(link.variant),
        "justify-start",
      )}
      href="#"
    >
      <link.icon className="mr-2 size-4" />
      {link.title}
      <span className={cn("ml-auto", !link.label && "hidden", getExpandedLabelClass(link.variant))}>
        {link.label}
      </span>
    </Link>
  );
}

function getCollapsedActiveClass(variant: NavLink["variant"]) {
  return variant === "default"
    ? "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white"
    : "";
}

function getExpandedActiveClass(variant: NavLink["variant"]) {
  return variant === "default"
    ? "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white"
    : "";
}

function getExpandedLabelClass(variant: NavLink["variant"]) {
  return variant === "default" ? "text-background dark:text-white" : "";
}
