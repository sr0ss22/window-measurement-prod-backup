"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { UserNav } from "@/components/user-nav";
import { TodaysAppointments } from "@/components/todays-appointments";
import { WeeklyAppointmentsCalendar } from "@/components/weekly-appointments-calendar";
import { TaskManager } from "@/components/task-manager";
import type { ProjectRecord } from "@/types/project";
import { Wrench, Home, ClipboardList, Calendar, LifeBuoy, CalendarCheck2, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Mock data for support tickets
const mockSupportTickets = [
  { id: "HD-12345", subject: "Installation issue with Duette shade", status: "Open" },
  { id: "HD-12346", subject: "PowerView motor not responding", status: "In Progress" },
  { id: "HD-12347", subject: "Question about mounting brackets", status: "Closed" },
  { id: "HD-12348", subject: "Remote pairing problem", status: "Open" },
];

export default function ProjectsDashboardPage() {
  const { user, session, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [allProjects, setAllProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = pageRef.current?.parentElement;
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > 10);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [isLoading]); // Re-attach listener if loading state changes

  const fetchAllProjects = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch user's company_id first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData?.company_id) {
      console.error("Error fetching user's company ID for projects:", profileError);
      toast({ title: "Error", description: "Could not retrieve your company information.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    const userCompanyId = profileData.company_id;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('company_id', userCompanyId); // Filter by company_id

    if (error) {
      console.error("❌ Project fetch error:", error);
      toast({ title: "Error", description: "Could not fetch project data.", variant: "destructive" });
    } else {
      setAllProjects(data as ProjectRecord[]);
    }
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchAllProjects();
    }
  }, [user, isAuthLoading, router, fetchAllProjects]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div ref={pageRef} className="relative flex flex-col min-h-full bg-black">
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300",
          isScrolled ? "h-[90px] md:h-[72px] bg-black shadow-md" : "h-[150px] md:h-[120px]"
        )}
      >
        <div className="ios:pt-[env(safe-area-inset-top)] h-full">
          <div className="container mx-auto px-4 text-white flex justify-between items-center h-full relative">
            {/* Expanded Title */}
            <div
              className={cn(
                "flex items-center gap-2 transition-all duration-300",
                isScrolled ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100"
              )}
            >
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Brite <Wrench className="h-8 w-8 text-[#F08200]" /> Install
              </h1>
            </div>

            {/* Compact Title */}
            <div
              className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 transition-all duration-300",
                isScrolled ? "opacity-100" : "opacity-0 translate-y-2 pointer-events-none"
              )}
            >
              <h1 className="text-xl font-bold">Upcoming Work</h1>
            </div>

            {/* Right side icons */}
            <UserNav />
          </div>
        </div>
      </header>

      <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 relative z-20 flex-grow">
        <div className="container mx-auto px-4 pt-6 pb-20">
          {!isMobile && allProjects.length === 0 && (
            <div className="text-center py-10 bg-white rounded-lg border border-dashed mb-6">
              <h2 className="text-xl font-semibold text-gray-700">Welcome!</h2>
              <p className="text-gray-500 mt-1">It looks like you don't have any projects yet.</p>
            </div>
          )}
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="projects">
                <ClipboardList className="mr-2 h-5 w-5" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <CalendarCheck2 className="mr-2 h-5 w-5" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="support">
                <LifeBuoy className="mr-2 h-5 w-5" />
                Support
              </TabsTrigger>
            </TabsList>
            <TabsContent value="projects" className="mt-6 space-y-6">
              <TodaysAppointments />
              <WeeklyAppointmentsCalendar />
            </TabsContent>
            <TabsContent value="tasks" className="mt-6">
              <TaskManager allProjects={allProjects} onUpdateProjects={fetchAllProjects} />
            </TabsContent>
            <TabsContent value="support" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>My Support Tickets</CardTitle>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Ticket
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockSupportTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.id}</TableCell>
                          <TableCell>{ticket.subject}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                ticket.status === 'Open' ? 'destructive' :
                                ticket.status === 'In Progress' ? 'warning' : 'success'
                              }
                            >
                              {ticket.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/30 backdrop-blur-lg border-t border-gray-200/50 shadow-lg z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="container mx-auto px-4 h-16 flex justify-around items-center">
          <Link href="/projects" className="flex flex-col items-center text-primary font-bold transition-colors">
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link href="/projects/all-active" className="flex flex-col items-center text-gray-600 hover:text-primary transition-colors">
            <ClipboardList className="h-6 w-6" />
            <span className="text-xs font-medium">Projects</span>
          </Link>
          <Link href="/projects/calendar" className="flex flex-col items-center text-gray-600 hover:text-primary transition-colors">
            <Calendar className="h-6 w-6" />
            <span className="text-xs font-medium">Calendar</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}