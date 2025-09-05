"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/unified-auth-context";
import { format, startOfToday, endOfToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import type { ProjectEvent, ProjectRecord } from "@/types/project";
import { CalendarDays } from "lucide-react";
import { WorkTypeIcon } from "@/components/work-type-icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Appointment extends ProjectEvent {
  projects: ProjectRecord;
}

export function TodaysAppointments() {
  const { supabase, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      const fetchTodaysAppointments = async () => {
    if (!user || !supabase) return;
    setIsLoading(true);

    // Fetch user's company_id first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

      if (profileError || !profileData?.company_id) {
        console.error("Error fetching user's company ID for appointments:", profileError);
        setIsLoading(false);
        return;
      }
      const userCompanyId = profileData.company_id;

      const todayStart = format(startOfToday(), "yyyy-MM-dd'T'00:00:00");
      const todayEnd = format(endOfToday(), "yyyy-MM-dd'T'23:59:59");

      const { data, error } = await supabase
        .from("project_events")
        .select("*, projects(*)")
        .eq("user_id", user.id)
        .eq("projects.company_id", userCompanyId) // Filter by company_id in joined projects
        .gte("event_date", todayStart)
        .lte("event_date", todayEnd)
        .order("event_time", { ascending: true });

      if (error) {
        console.error("Error fetching today's appointments:", error);
      } else {
        setAppointments(data as Appointment[]);
      }
      setIsLoading(false);
    };

    fetchTodaysAppointments();
  }, [supabase, user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-gray-700" />
          <CardTitle className="text-xl font-bold text-gray-800">
            Today
          </CardTitle>
        </div>
        <span className="text-sm font-medium text-gray-500">
          {format(new Date(), "eeee, MMMM d")}
        </span>
      </CardHeader>
      <CardContent>
        {appointments.length > 0 ? (
          <div className="space-y-2">
            {appointments.map((appointment) => (
              <Link
                href={`/work-orders/${appointment.project_id}`}
                key={appointment.id}
                className="block"
              >
                <div className="bg-white p-3 rounded-lg border hover:bg-gray-50 transition-colors shadow-sm relative">
                  <Badge
                    variant="default"
                    className={cn(
                      "text-xs absolute top-3 right-3",
                      appointment.projects.status === 'Scheduled' ? 'bg-blue-500' :
                      appointment.projects.status === 'On-Site Complete' ? 'bg-green-500' :
                      appointment.projects.status === 'Complete' ? 'bg-purple-500' : 'bg-gray-500'
                    )}
                  >
                    {appointment.projects.status}
                  </Badge>
                  <p className="font-semibold text-gray-900 pr-24">
                    {appointment.projects.customer_name}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span>WO#: {appointment.projects.work_order_number || "N/A"}</span>
                    <WorkTypeIcon project={appointment.projects} />
                  </p>
                  {appointment.event_time && (
                    <p className="text-sm text-gray-500 mt-1">
                      Time: {format(parseISO(`1970-01-01T${appointment.event_time}`), 'h:mm a')} | Window: {appointment.appointment_window} hrs
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">
            No appointments scheduled for today.
          </p>
        )}
      </CardContent>
    </Card>
  );
}