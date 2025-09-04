"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { format, startOfMonth, endOfMonth, parseISO, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import type { ProjectEvent, ProjectRecord } from "@/types/project";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { WorkTypeIcon } from "@/components/work-type-icon";
import { formatWithOrdinal } from "@/utils/date-formatter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Appointment extends ProjectEvent {
  projects: ProjectRecord;
}

export function WeeklyAppointmentsCalendar() {
  const { supabase, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) return;
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

      const monthStart = format(startOfMonth(currentDate), "yyyy-MM-dd'T'00:00:00");
      const monthEnd = format(endOfMonth(currentDate), "yyyy-MM-dd'T'23:59:59");

      const { data, error } = await supabase
        .from("project_events")
        .select("*, projects(*)")
        .eq("user_id", user.id)
        .eq("projects.company_id", userCompanyId) // Filter by company_id in joined projects
        .gte("event_date", monthStart)
        .lte("event_date", monthEnd)
        .order("event_time", { ascending: true });

      if (error) {
        console.error("Error fetching appointments:", error);
      } else {
        setAppointments(data as Appointment[]);
      }
      setIsLoading(false);
    };

    fetchAppointments();
  }, [supabase, user, currentDate]);

  const scheduledDays = useMemo(() => {
    return appointments.map(e => parseISO(e.event_date));
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return appointments.filter(e => isSameDay(parseISO(e.event_date), selectedDate));
  }, [appointments, selectedDate]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-gray-700" />
          <CardTitle className="text-xl font-bold text-gray-800">
            Calendar
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={currentDate}
          onMonthChange={setCurrentDate}
          className="rounded-md border"
          modifiers={{ scheduled: scheduledDays }}
          modifiersClassNames={{
            scheduled: 'day-scheduled',
          }}
        />
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="font-bold text-lg text-gray-800">
              Appointments {selectedDate ? format(selectedDate, "eeee") : ''}
            </h3>
            {selectedDate && (
              <p className="text-sm text-gray-500">{formatWithOrdinal(selectedDate)}</p>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {selectedDayAppointments.length > 0 ? (
              selectedDayAppointments.map((appointment) => (
                <Link
                  href={`/work-order?id=${appointment.project_id}`}
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
                    <p className="font-semibold text-gray-900 pr-24">{appointment.projects.customer_name}</p>
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
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">
                No appointments for this day.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}