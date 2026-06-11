"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@code-main/ui/components/select";
import { cn } from "@code-main/ui/lib/utils";

import { accounts } from "@/features/mail/components/mail-data";

export function AccountSwitcher({ isCollapsed }: { readonly isCollapsed: boolean }) {
  const [selectedAccount, setSelectedAccount] = React.useState(accounts[0].email);
  const account = accounts.find((item) => item.email === selectedAccount) ?? accounts[0];

  return (
    <Select
      defaultValue={selectedAccount}
      onValueChange={(value) => {
        if (value) {
          setSelectedAccount(value);
        }
      }}
    >
      <SelectTrigger
        aria-label="Select account"
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex size-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden",
        )}
      >
        <SelectValue>
          {account.icon}
          <span className={cn("ml-2", isCollapsed && "hidden")}>{account.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-56">
        {accounts.map((item) => (
          <SelectItem key={item.email} value={item.email}>
            <div className="flex items-center gap-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
              {item.icon}
              {item.email}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
