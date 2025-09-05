"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MoreVertical, Calendar as CalendarIcon, CheckCircle, FileText, Ruler, Wrench, RefreshCw, X } from "lucide-react";
import type { ProjectRecord } from "@/types/project";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import { format, parseISO, addDays, isBefore, startOfToday } from "date-fns";
import { useAuth } from "@/context/unified-auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate } from "@/utils/date-formatter";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { WorkTypeIcon } from "@/components/work-type-icon";

interface ProjectCardProps {
  project: ProjectRecord;
  onDelete: (project: ProjectRecord) => void;
  onUpdate: () => void;
}

export function ProjectCard({ project, onDelete, onUpdate }: ProjectCardProps) {
  const { toast } = useToast();
  const { supabase, user } = useAuth();
  const router = useRouter();
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    project.schedule_date ? parseISO(project.schedule_date) : undefined
  );
  const [scheduleTime, setScheduleTime] = useState<string>("09:00");
  const [appointmentWindow, setAppointmentWindow] = useState<string>("2");

  useEffect(() => {
    if (project.schedule_date) {
      let date: Date;
      if (project.schedule_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = project.schedule_date.split('-').map(Number);
        date = new Date(year, month - 1, day);
      } else {
        date = parseISO(project.schedule_date);
      }
      if (!isNaN(date.getTime())) {
        setScheduleDate(date);
      } else {
        setScheduleDate(undefined);
      }
    } else {
      setScheduleDate(undefined);
    }
  }, [project.schedule_date]);

  const handleScheduleProject = async () => {
    if (!scheduleDate || isNaN(scheduleDate.getTime())) {
      toast({ title: "Error", description: "Please select a valid date.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to schedule projects.", variant: "destructive" });
      return;
    }

    const formattedDate = format(scheduleDate, 'yyyy-MM-dd');
    const calculatedFollowUpDate = format(addDays(scheduleDate, 2), 'yyyy-MM-dd');

    const { error: eventError } = await supabase
      .from('project_events')
      .insert({
        project_id: project.id,
        user_id: user.id,
        event_date: formattedDate,
        event_time: scheduleTime,
        appointment_window: appointmentWindow,
        event_type: 'schedule',
      });

    if (eventError) {
      console.error("Error scheduling project event:", eventError);
      toast({ title: "Error", description: "Could not schedule project event.", variant: "destructive" });
      return;
    }

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ 
        schedule_date: formattedDate, 
        status: 'Scheduled',
        follow_up_date: calculatedFollowUpDate,
      })
      .eq('id', project.id);

    if (projectUpdateError) {
      console.error("Error updating project schedule date:", projectUpdateError);
      toast({ title: "Error", description: "Could not update project schedule date.", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Project has been scheduled." });
    setIsScheduleDialogOpen(false);
    onUpdate();
  };

  const handleAcceptProject = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to accept projects.", variant: "destructive" });
      return;
    }

    const today = new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');
    const calculatedFollowUpDate = format(addDays(today, 2), 'yyyy-MM-dd');

    const { error: eventError } = await supabase
      .from('project_events')
      .insert({
        project_id: project.id,
        user_id: user.id,
        event_date: formattedDate,
        event_time: null,
        appointment_window: null,
        event_type: 'accepted',
      });

    if (eventError) {
      console.error("Error creating acceptance event:", eventError);
      toast({ title: "Error", description: "Could not record project acceptance.", variant: "destructive" });
      return;
    }

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ 
        status: 'Scheduled',
        schedule_date: project.schedule_date || formattedDate,
        follow_up_date: project.follow_up_date || calculatedFollowUpDate,
      })
      .eq('id', project.id);

    if (projectUpdateError) {
      console.error("Error updating project status to Scheduled:", projectUpdateError);
      toast({ title: "Error", description: "Could not update project status.", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Project accepted and scheduled." });
    onUpdate();
  };

  const handleReport = () => {
    toast({ title: "Report Feature", description: "This feature is coming soon!" });
  };

  const handleSubmit = () => {
    toast({ title: "Submit Feature", description: "This feature is coming soon!" });
  };

  const handleMeasureEntry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/?projectId=${project.id}`);
  };

  const isOverdue = project.follow_up_date && isBefore(parseISO(project.follow_up_date), startOfToday());
  const isPendingAcceptance = project.status === 'Pending Acceptance';
  const isPendingSchedule = project.status === 'Pending Schedule';
  const isScheduled = project.status === 'Scheduled';
  const isOnSiteComplete = project.status === 'On-Site Complete';

  return (
    <>
      <Link href={`/work-orders/${project.id}`} className="block">
        <Card className={cn(
          "flex flex-col h-full cursor-pointer hover:shadow-lg transition-shadow duration-200",
          isOverdue && "border-l-4 border-red-500"
        )}>
          <CardHeader className="p-4 relative">
            <Badge
              variant="default"
              className={cn(
                "text-xs absolute top-4 right-4",
                project.status === 'Scheduled' ? 'bg-blue-500' :
                project.status === 'On-Site Complete' ? 'bg-green-500' :
                project.status === 'Complete' ? 'bg-purple-500' : 'bg-gray-500'
              )}
            >
              {project.status}
            </Badge>
            <CardTitle className="text-xl text-gray-800 pr-24">{project.customer_name || project.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>WO#: {project.work_order_number || 'N/A'}</span>
              <WorkTypeIcon project={project} className="h-4 w-4 text-gray-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow text-sm text-gray-600 p-4 space-y-1">
            <p><strong>Schedule Date:</strong> {project.schedule_date ? formatDate(project.schedule_date) : 'N/A'}</p>
            <p><strong>Follow Up Date:</strong> {project.follow_up_date ? formatDate(project.follow_up_date) : 'N/A'}</p>
            <p><strong>Seller:</strong> {project.seller_name || 'N/A'}</p>
            <p><strong>Address:</strong> {project.address || 'N/A'}</p>
          </CardContent>
          <CardFooter className="flex justify-between items-center p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <DropdownMenuItem asChild>
                  <Link href={`/work-orders/${project.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span>View Work Order</span>
                  </Link>
                </DropdownMenuItem>
                {project.work_type === 'Measure' && (
                  <DropdownMenuItem onClick={handleMeasureEntry}>
                    <Ruler className="mr-2 h-4 w-4" />
                    <span>Measure Entry</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDelete(project)} className="text-red-500">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isPendingAcceptance ? (
              <Button 
                className="bg-green-600 text-white hover:bg-green-700" 
                size="sm" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAcceptProject();
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Accept
              </Button>
            ) : isPendingSchedule ? (
              <Button
                className="bg-black text-white hover:bg-black/80"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsScheduleDialogOpen(true);
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            ) : isScheduled && project.work_type === 'Measure' ? (
              <Button
                className="bg-black text-white hover:bg-black/80"
                size="sm"
                onClick={handleMeasureEntry}
              >
                <Ruler className="mr-2 h-4 w-4" />
                Measure
              </Button>
            ) : isScheduled ? (
              <Button
                className="bg-black text-white hover:bg-black/80"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsScheduleDialogOpen(true);
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Reschedule
              </Button>
            ) : isOnSiteComplete ? (
              <Button
                className="bg-black text-white hover:bg-black/80"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Submit
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </Link>

      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-xl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Schedule Project</DialogTitle>
            <DialogDescription>
              Select a date, time, and appointment window for "{project.customer_name || project.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto py-4 pr-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Appointment Window</Label>
              <ToggleGroup
                type="single"
                value={appointmentWindow}
                onValueChange={(value) => { if (value) setAppointmentWindow(value) }}
                className="grid grid-cols-4 gap-2"
              >
                <ToggleGroupItem value="1" className="h-16 text-lg">1 hr</ToggleGroupItem>
                <ToggleGroupItem value="2" className="h-16 text-lg">2 hrs</ToggleGroupItem>
                <ToggleGroupItem value="4" className="h-16 text-lg">4 hrs</ToggleGroupItem>
                <ToggleGroupItem value="8" className="h-16 text-lg">8 hrs</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4">
            <div className="flex w-full gap-2">
              <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)} className="flex-1">
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleScheduleProject} className="flex-1">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}