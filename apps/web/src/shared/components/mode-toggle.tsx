"use client";

import { Button } from "@code-main/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@code-main/ui/components/dropdown-menu";
import { cn } from "@code-main/ui/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

const themeIcons = (
  <>
    <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
    <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
  </>
);

export function ModeToggle({ isCollapsed = false }: { readonly isCollapsed?: boolean }) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={getThemeTrigger(isCollapsed)}>
        <span className={cn("relative flex items-center", !isCollapsed && "size-[1.2rem]")}>
          {themeIcons}
        </span>
        {isCollapsed ? null : <span className="text-sm">Theme</span>}
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isCollapsed ? "end" : "start"}>
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getThemeTrigger(isCollapsed: boolean) {
  if (isCollapsed) {
    return <Button size="icon" variant="ghost" />;
  }

  return (
    <Button className="w-full justify-start gap-2 px-2 text-muted-foreground" variant="ghost" />
  );
}
