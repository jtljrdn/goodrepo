"use client"

import * as React from "react"
import { Menu } from "@base-ui/react/menu"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Logout03Icon } from "@hugeicons/core-free-icons"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { authClient } from "@/lib/auth-client"

const TILE = "rounded-none after:rounded-none"

export function AccountMenu({
  email,
  name,
  image,
  allowance,
}: {
  email: string
  name: string
  image: string | null
  allowance: string | null
}) {
  const [busy, setBusy] = React.useState(false)

  // Not router.refresh(): it leaves the signed-in account strip on screen, because that strip
  // is a server component behind a Suspense boundary in a partially prerendered page.
  async function signOut() {
    setBusy(true)
    await authClient.signOut()
    window.location.reload()
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account: ${email}`}
        className="group -mr-6 flex h-12 items-center gap-2 self-stretch border-l border-border pr-6 pl-4 transition-colors outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-popup-open:bg-muted"
      >
        <Avatar size="sm" className={`size-5 ${TILE}`}>
          {image ? (
            <AvatarImage src={image} alt="" className="rounded-none" />
          ) : null}
          <AvatarFallback className="rounded-none bg-foreground text-[10px] leading-none font-bold text-background">
            {email.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className="size-3 text-muted-foreground transition-transform duration-200 group-data-popup-open:-rotate-180"
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          sideOffset={0}
          align="end"
          className="z-30 outline-none"
        >
          <Menu.Popup className="max-w-72 min-w-56 origin-[var(--transform-origin)] border border-border bg-popover py-1 text-popover-foreground transition-[opacity,translate] duration-150 ease-out outline-none data-ending-style:-translate-y-1 data-ending-style:opacity-0 data-starting-style:-translate-y-1 data-starting-style:opacity-0">
            <div className="px-3 py-2">
              <p className="truncate text-xs font-medium" title={email}>
                {name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {email}
              </p>
            </div>

            {allowance ? (
              <>
                <Menu.Separator className="h-px bg-border" />
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {allowance}
                </p>
              </>
            ) : null}

            <Menu.Separator className="h-px bg-border" />
            <Menu.Item
              disabled={busy}
              closeOnClick={false}
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 text-xs outline-none select-none data-highlighted:bg-muted data-disabled:opacity-50"
            >
              <HugeiconsIcon
                icon={Logout03Icon}
                strokeWidth={2}
                className="size-3.5 text-muted-foreground"
              />
              {busy ? "Signing out" : "Sign out"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
