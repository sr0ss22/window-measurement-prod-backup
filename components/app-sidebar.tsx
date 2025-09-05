"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Wrench, FolderOpen, LogOut, Calendar, User as UserIcon, ClipboardList, FileClock, CalendarPlus, CalendarCheck2, HardHat, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/unified-auth-context"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { workOrdersService } from "@/apiUtils/services/workOrdersService"
import { toast } from "@/components/ui/use-toast"

export function AppSidebar() {
  const { user, session, accessToken, signOut } = useAuth() // Destructure session here
  const { isMobile, setOpenMobile } = useSidebar() // Destructure setOpenMobile

  const [projectCounts, setProjectCounts] = useState({
    all: 0,
    pendingAcceptance: 0,
    pendingSchedule: 0,
    scheduled: 0,
    onSiteComplete: 0,
  })
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchProjectCounts = useCallback(async () => {
    if (!user || !accessToken) return

    try {
      // Fetch work orders from CPQ API and count by status
      const response = await workOrdersService.getWorkOrders({
        page: 1,
        pageSize: 1000, // Get all to count
      }, accessToken);

      const workOrders = response.workOrders;
      
      // Count by status
      const counts = {
        all: workOrders.length,
        pendingAcceptance: workOrders.filter(wo => wo.status === 'Pending Acceptance').length,
        pendingSchedule: workOrders.filter(wo => wo.status === 'Pending Schedule').length,
        scheduled: workOrders.filter(wo => wo.status === 'Scheduled').length,
        onSiteComplete: workOrders.filter(wo => wo.status === 'On-Site Complete').length,
      };

      setProjectCounts(counts);
    } catch (error) {
      console.error('Error fetching project counts:', error);
      // Set all counts to 0 on error
      setProjectCounts({
        all: 0,
        pendingAcceptance: 0,
        pendingSchedule: 0,
        scheduled: 0,
        onSiteComplete: 0,
      });
    }
  }, [user, accessToken])

  useEffect(() => {
    fetchProjectCounts()
  }, [fetchProjectCounts])

  const handleMenuItemClick = () => {
    if (isMobile) {
      setOpenMobile(false); // Close the sidebar on mobile
    }
  }

  const handleSyncWorkOrders = async () => {
    if (!user || !accessToken) {
      toast({ title: "Sync Failed", description: "You must be logged in to sync work orders.", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    try {
      // Refresh work orders from CPQ API
      await fetchProjectCounts();
      toast({ title: "Sync Successful", description: "Work orders refreshed from CPQ API." });
    } catch (error: any) {
      console.error("Error syncing work orders:", error);
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Sidebar side="right">
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <Wrench className="h-8 w-8 text-[#F08200]" />
          <h2 className="text-xl font-bold text-charcoal group-data-[collapsible=icon]:hidden">Brite Install</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Upcoming Work" onClick={handleMenuItemClick}>
              <Link href="/projects">
                <FolderOpen />
                <span>Upcoming Work</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm font-medium text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span>Projects</span>
            </div>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild onClick={handleMenuItemClick}>
                  <Link href="/projects/all-active">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    All Active Work
                    <Badge variant="default" className="ml-auto bg-blue-500 text-white">{projectCounts.all}</Badge>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild onClick={handleMenuItemClick}>
                  <Link href="/projects/pending-acceptance">
                    <FileClock className="mr-2 h-4 w-4" />
                    Pending Acceptance
                    <Badge variant="default" className="ml-auto bg-blue-500 text-white">{projectCounts.pendingAcceptance}</Badge>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild onClick={handleMenuItemClick}>
                  <Link href="/projects/pending-schedule">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Pending Schedule
                    <Badge variant="default" className="ml-auto bg-blue-500 text-white">{projectCounts.pendingSchedule}</Badge>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild onClick={handleMenuItemClick}>
                  <Link href="/projects/scheduled">
                    <CalendarCheck2 className="mr-2 h-4 w-4" />
                    Scheduled
                    <Badge variant="default" className="ml-auto bg-blue-500 text-white">{projectCounts.scheduled}</Badge>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild onClick={handleMenuItemClick}>
                  <Link href="/projects/on-site-complete">
                    <HardHat className="mr-2 h-4 w-4" />
                    On-Site Complete
                    <Badge variant="default" className="ml-auto bg-blue-500 text-white">{projectCounts.onSiteComplete}</Badge>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Calendar" onClick={handleMenuItemClick}>
              <Link href="/projects/calendar">
                <Calendar />
                <span>Calendar</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Form Builder" onClick={handleMenuItemClick}>
              <Link href="/forms">
                <Wrench />
                <span>Form Builder</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <div className="p-2">
          <Button
            onClick={handleSyncWorkOrders}
            disabled={isSyncing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSyncing ? (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Work Orders
          </Button>
        </div>
        {user && (
          <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:hidden">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || "User"} />
              <AvatarFallback>
                <UserIcon className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium leading-none">Shaun Ross</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Log Out">
              <LogOut />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}