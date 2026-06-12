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

import { accounts, GmailIcon } from "@/features/mail/components/mail-data";

type Account = {
  readonly email: string;
  readonly label: string;
};

export function AccountSwitcher({
  account,
  isCollapsed,
}: {
  readonly account?: Account;
  readonly isCollapsed: boolean;
}) {
  const accountOptions = React.useMemo(
    () =>
      account
        ? [
            {
              ...account,
              icon: <GmailIcon />,
            },
          ]
        : accounts,
    [account],
  );
  const firstAccount = accountOptions[0];
  const [selectedAccount, setSelectedAccount] = React.useState(firstAccount.email);
  const selectedAccountOption =
    accountOptions.find((item) => item.email === selectedAccount) ?? firstAccount;

  React.useEffect(() => {
    setSelectedAccount(firstAccount.email);
  }, [firstAccount]);

  return (
    <Select
      value={selectedAccount}
      onValueChange={(value) => {
        if (value) {
          setSelectedAccount(value);
        }
      }}
    >
      <SelectTrigger
        aria-label="Select account"
        className={cn(
          "flex items-center gap-2 rounded-md [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-2 [&>span]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
          getAccountTriggerSizeClassName(isCollapsed),
        )}
      >
        <SelectValue className={cn(isCollapsed && "flex-none justify-center")}>
          {selectedAccountOption.icon}
          <span className={cn("truncate text-sm font-medium", isCollapsed && "hidden")}>
            {selectedAccountOption.email}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        // Match the trigger width when expanded (like the shadcn mail example);
        // fall back to a readable fixed width when the sidebar is collapsed and the
        // trigger is only a 36px icon.
        className={getAccountContentWidthClassName(isCollapsed)}
      >
        {accountOptions.map((item) => (
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

function getAccountTriggerSizeClassName(isCollapsed: boolean) {
  if (isCollapsed) {
    return "flex shrink-0 items-center justify-center p-0 data-[size=default]:size-9 [&>span]:w-auto [&>svg]:hidden";
  }

  return "w-full data-[size=default]:h-10";
}

function getAccountContentWidthClassName(isCollapsed: boolean) {
  return isCollapsed ? "w-56" : "w-(--anchor-width)";
}
