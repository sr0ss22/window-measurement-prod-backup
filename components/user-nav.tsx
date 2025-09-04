"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationBell } from "./notification-bell"

export function UserNav() {
  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <SidebarTrigger />
    </div>
  )
}