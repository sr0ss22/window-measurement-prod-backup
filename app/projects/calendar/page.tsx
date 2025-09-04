"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { UserNav } from "@/components/user-nav";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format, parseISO, isSameDay } from "date-fns";
import type { ProjectRecord } from "@/app/projects/page";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, ClipboardList, Calendar as CalendarIcon } from "lucide-react";
import { WorkTypeIcon } from "@/components/work-type-icon";

// Define a type for the fetched event data
interface ProjectEvent {
  id: string;
  project_id: string;
  event_date: string;
  event_time: string | null;
  appointment_window: string | null;
  event_type: string;
  projects: { // Joined project data
    name: string;
    customer_name: string | null;
    work_order_number: string | null;
    status: 'Pending Acceptance' | 'Scheduled' | 'On-Site Complete' | 'Complete';
  } | null;
}

export default function CalendarPage() {
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<ProjectEvent[]>([]); // Renamed from projects to events
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch user's company_id first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData?.company_id) {
      console.error("Error fetching user's company ID for events:", profileError);
      toast({ title: "Error", description: "Could not retrieve your company information.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    const userCompanyId = profileData.company_id;

    const { data, error } = await supabase
      .from('project_events') // Fetch from the new project_events table
      .select(`
        id,
        project_id,
        event_date,
        event_time,
        appointment_window,
        event_type,
        projects (
          *,
          name,
          customer_name,
          work_order_number,
          status
        )
      `)
      .eq('user_id', user.id)
      .eq('projects.company_id', userCompanyId) // Filter by company_id in joined projects
      .order('event_date', { ascending: true });

    if (error) {
      console.error("Error fetching events for calendar:", error);
      toast({ title: "Error", description: "Could not fetch your events.", variant: "destructive" });
    } else {
      setEvents(data as ProjectEvent[]);
    }
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchEvents();
    }
  }, [user, isAuthLoading, router, fetchEvents]);

  const scheduledDays = useMemo(() => {
    return events.map(e => parseISO(e.event_date));
  }, [events]);

  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(e => isSameDay(parseISO(e.event_date), selectedDate));
  }, [events, selectedDate]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      <main className="relative z-10 flex flex-col min-h-screen">
        <div className="h-[150px] md:h-[120px] flex-shrink-0">
          <div className="ios:pt-[env(safe-area-inset-top)] h-full">
            <div className="container mx-auto px-4 text-white flex justify-between items-center h-full">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <CalendarIcon className="h-7 w-7 text-primary-foreground" />
                <h1 className="text-2xl font-bold">Calendar</h1>
              </div>
              <UserNav />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 flex-grow">
          <div className="container mx-auto px-4 pt-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <Card>
                  <CardContent className="p-2 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md w-full"
                      modifiers={{ scheduled: scheduledDays }}
                      modifiersClassNames={{
                        scheduled: 'day-scheduled',
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Appointments for {selectedDate ? format(selectedDate, "PPP") : "..."}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {eventsForSelectedDay.length > 0 ? (
                      eventsForSelectedDay.map(event => (
                        <Link href={`/?projectId=${event.project_id}`} key={event.id} className="block">
                          <div className="border p-3 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex justify-between items-center">
                              <p className="font-semibold text-gray-800">{event.projects?.customer_name || event.projects?.name || 'N/A'}</p>
                              <Badge
                                variant="default"
                                className={
                                  event.projects?.status === 'Scheduled' ? 'bg-blue-500' :
                                  event.projects?.status === 'On-Site Complete' ? 'bg-green-500' :
                                  event.projects?.status === 'Complete' ? 'bg-purple-500' : 'bg-gray-500'
                                }
                              >
                                {event.projects?.status || 'N/A'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 flex items-center gap-2">
                              <span>WO#: {event.projects?.work_order_number || 'N/A'}</span>
                              {event.projects && <WorkTypeIcon project={event.projects as ProjectRecord} />}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {event.event_time && `Time: ${format(parseISO(`1970-01-01T${event.event_time}`), 'h:mm a')}`}
                              {event.appointment_window && ` | Window: ${event.appointment_window} hrs`}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="text-gray-500">No appointments scheduled for this day.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/30 backdrop-blur-lg border-t border-gray-200/50 shadow-lg z-50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="container mx-auto px-4 h-16 flex justify-around items-center">
          <Link href="/projects" className="flex flex-col items-center text-gray-600 hover:text-primary transition-colors">
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link href="/projects/all-active" className="flex flex-col items-center text-gray-600 hover:text-primary transition-colors">
            <ClipboardList className="h-6 w-6" />
            <span className="text-xs font-medium">Projects</span>
          </Link>
          <Link href="/projects/calendar" className="flex flex-col items-center text-primary font-bold transition-colors">
            <Calendar className="h-6 w-6" />
            <span className="text-xs font-medium">Calendar</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}