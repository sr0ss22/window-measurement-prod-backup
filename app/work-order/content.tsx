"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageCircle,
  CheckCircle,
  Calendar as CalendarIcon,
  FileText,
  Send,
  User,
  MapPin,
  Phone,
  Mail,
  Clock,
  DollarSign,
  Link as LinkIcon,
  Info,
  ClipboardList,
  Truck,
  Building,
  Tag,
  AlertCircle,
  Loader2,
  Ruler,
  Wrench,
  RefreshCw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CommentsHistorySheet } from "@/components/work-order/comments-history-sheet";
import { ProjectDetailsSection } from "@/components/work-order/project-details-section";
import { LineItemDisplay } from "@/components/work-order/line-item-display";
import type { ProjectRecord, ProjectEvent, ProjectComment } from "@/types/project";
import type { WindowItem } from "@/types/window-item";
import { formatDate } from "@/utils/date-formatter";
import { format, parseISO, isPast, addDays, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components
import { UserNav } from "@/components/user-nav";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkTypeIcon } from "@/components/work-type-icon";
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

export default function WorkOrderDetailContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const { isMobile } = useSidebar();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [windowItems, setWindowItems] = useState<WindowItem[]>([]);
  const [projectEvents, setProjectEvents] = useState<ProjectEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommentsSheetOpen, setIsCommentsSheetOpen] = useState(false);
  const [isSubmittingMeasure, setIsSubmittingMeasure] = useState(false);
  const [unreadCommentCount, setUnreadCommentCount] = useState(0);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState<string>("09:00");
  const [appointmentWindow, setAppointmentWindow] = useState<string>("2");

  const fetchProjectData = useCallback(async () => {
    if (!user || !projectId) return;

    setIsLoading(true);
    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error("Error fetching project:", projectError);
        toast({ title: "Error", description: "Could not load project details.", variant: "destructive" });
        router.push('/projects');
        return;
      }
      setProject(projectData as ProjectRecord);

      // Set initial schedule date if available
      if (projectData.schedule_date) {
        let date: Date;
        if (projectData.schedule_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = projectData.schedule_date.split('-').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          date = parseISO(projectData.schedule_date);
        }
        if (!isNaN(date.getTime())) {
          setScheduleDate(date);
        } else {
          setScheduleDate(undefined);
        }
      } else {
        setScheduleDate(undefined);
      }

      // Fetch associated window measurements
      const { data: windowData, error: windowError } = await supabase
        .from("window_measurements")
        .select("*")
        .eq("project_id", projectId)
        .order("line_number", { ascending: true });

      if (windowError) {
        console.error("Error fetching window items:", windowError);
        toast({ title: "Error", description: "Could not load window items.", variant: "destructive" });
      } else {
        const loadedWindows: WindowItem[] = windowData.map(dbItem => ({
          id: dbItem.id,
          lineNumber: dbItem.line_number,
          location: dbItem.data?.location || "",
          windowNumber: dbItem.data?.windowNumber || "",
          product: dbItem.data?.product || "",
          width: dbItem.data?.width || 0,
          height: dbItem.data?.height || 0,
          depth: dbItem.data?.depth || 0,
          mountType: dbItem.data?.mountType || "",
          controlType: dbItem.data?.controlType || "",
          controlLength: dbItem.data?.controlLength || "",
          tilt: dbItem.data?.tilt || "",
          sbs: dbItem.data?.sbs || "",
          stackPosition: dbItem.data?.stackPosition || "",
          takeDown: dbItem.data?.takeDown || false,
          hardSurface: dbItem.data?.hardSurface || false,
          holdDown: dbItem.data?.holdDown || false,
          tallWindow12: dbItem.data?.tallWindow12 || false,
          tallWindow16: dbItem.data?.tallWindow16 || false,
          comments: dbItem.data?.comments || "",
          notes: dbItem.data?.notes || "",
          isExpanded: false,
          image: dbItem.image_path,
          annotations: dbItem.annotations_path,
          wizardImage: dbItem.wizard_image_path,
          wizardMeasurements: dbItem.wizardMeasurements || dbItem.data?.wizardMeasurements || null,
          wizardWindowBounds: dbItem.wizardWindowBounds || dbItem.data?.wizardWindowBounds || null,
          signature: dbItem.signature_path,
          uploadedFiles: dbItem.uploaded_files_paths?.map((f: any) => ({ id: f.id, name: f.name, type: 'unknown', data: '', path: f.path })) || [],
        }));
        setWindowItems(loadedWindows);
      }

      // Fetch project events for history tab
      const { data: eventsData, error: eventsError } = await supabase
        .from('project_events')
        .select(`id, event_date, event_time, appointment_window, event_type, projects (name, customer_name)`)
        .eq('project_id', projectId)
        .order('event_date', { ascending: false })
        .order('event_time', { ascending: false });

      if (eventsError) {
        console.error("Error fetching project events:", eventsError);
      } else {
        setProjectEvents(eventsData as ProjectEvent[]);
      }

    } catch (error) {
      console.error("Failed to fetch project data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId, supabase, router]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user || !projectId) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('count', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .eq('is_read', false);
    
    if (!error) {
      setUnreadCommentCount(count || 0);
    }
  }, [user, projectId, supabase]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchProjectData();
      fetchUnreadCount();
    }
  }, [user, isAuthLoading, projectId, fetchProjectData, fetchUnreadCount, router]);

  useEffect(() => {
    if (!user || !projectId) return;
    const channel = supabase
      .channel(`project_notifications:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `project_id=eq.${projectId}` },
        () => fetchUnreadCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, projectId, supabase, fetchUnreadCount]);

  const handleCommentsSheetOpen = async (open: boolean) => {
    setIsCommentsSheetOpen(open);
    if (open && unreadCommentCount > 0) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('project_id', projectId)
        .eq('is_read', false);
      if (!error) {
        setUnreadCommentCount(0);
      }
    }
  };

  const getProgressBarValue = (status: ProjectRecord['status']) => {
    switch (status) {
      case 'Pending Acceptance': return 0;
      case 'Pending Schedule': return 33;
      case 'Scheduled': return 66;
      case 'On-Site Complete': return 100;
      case 'Complete': return 100;
      default: return 0;
    }
  };

  const getStatusBadgeClass = (status: ProjectRecord['status']) => {
    switch (status) {
      case 'Pending Acceptance': return 'bg-gray-500';
      case 'Scheduled': return 'bg-blue-500';
      case 'On-Site Complete': return 'bg-green-500';
      case 'Complete': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAcceptProject = async () => {
    if (!user || !project) return;
    const today = new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');
    const calculatedFollowUpDate = format(addDays(today, 2), 'yyyy-MM-dd');
    try {
      const { error: eventError } = await supabase
        .from('project_events')
        .insert({ project_id: project.id, user_id: user.id, event_date: formattedDate, event_type: 'accepted' });
      if (eventError) throw new Error(eventError.message);
      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({ status: 'Scheduled', schedule_date: project.schedule_date || formattedDate, follow_up_date: project.follow_up_date || calculatedFollowUpDate })
        .eq('id', project.id);
      if (projectUpdateError) throw new Error(projectUpdateError.message);
      toast({ title: "Success", description: "Project accepted and scheduled." });
      fetchProjectData();
    } catch (error: any) {
      toast({ title: "Error", description: `Could not accept project: ${error.message}`, variant: "destructive" });
    }
  };

  const handleScheduleProject = async () => {
    if (!scheduleDate || isNaN(scheduleDate.getTime()) || !user || !project) {
      toast({ title: "Error", description: "Please select a valid date.", variant: "destructive" });
      return;
    }

    const formattedDate = format(scheduleDate, 'yyyy-MM-dd');
    const calculatedFollowUpDate = format(addDays(scheduleDate, 2), 'yyyy-MM-dd');

    try {
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

      if (eventError) throw new Error(eventError.message);

      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({ 
          schedule_date: formattedDate, 
          status: 'Scheduled',
          follow_up_date: calculatedFollowUpDate,
        })
        .eq('id', project.id);

      if (projectUpdateError) throw new Error(projectUpdateError.message);

      toast({ title: "Success", description: "Project has been scheduled." });
      setIsScheduleDialogOpen(false);
      fetchProjectData();
    } catch (error: any) {
      toast({ title: "Error", description: `Could not schedule project: ${error.message}`, variant: "destructive" });
    }
  };

  const handleMeasureEntry = () => {
    if (project?.id) {
      router.push(`/?projectId=${project.id}`);
    } else {
      toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
    }
  };

  const handleReport = () => {
    toast({ title: "Report Feature", description: "This feature is coming soon!" });
  };

  const handleSubmitMeasure = async () => {
    if (!user || !project) return;
    setIsSubmittingMeasure(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-measure', { body: { projectId: project.id } });
      if (error || data.error) throw new Error(error?.message || data.error);
      toast({ title: "Measure Submitted", description: `Project "${data.project.name}" marked as measured.` });
      fetchProjectData();
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingMeasure(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 text-center text-gray-500">
        Project not found or you do not have access.
        <Button onClick={() => router.push('/projects')} className="mt-4">Back to Projects</Button>
      </div>
    );
  }

  const isOverdue = project.follow_up_date && isPast(parseISO(project.follow_up_date));

  return (
    <div className="relative min-h-screen bg-black">
      <main className="relative z-10">
        <div className="h-[150px] md:h-[120px]">
          <div className="ios:pt-[env(safe-area-inset-top)] h-full">
            <div className="container mx-auto px-4 text-white flex justify-center items-center relative h-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-6 w-6" />
                </Button>
              </div>
              <div className="text-center">
                <h1 className="text-lg font-bold truncate flex items-center justify-center gap-2">
                  <span>WO#: {project.work_order_number || 'N/A'}</span>
                  <WorkTypeIcon className="h-5 w-5 text-current" project={project} />
                </h1>
                <p className="text-white/80 truncate">{project.customer_name || project.name}</p>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleCommentsSheetOpen(true)} className="relative">
                  <MessageCircle className="h-6 w-6" />
                  {unreadCommentCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
                  )}
                </Button>
                {isMobile && <SidebarTrigger />}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 min-h-[calc(100vh-150px-80px)] md:min-h-[calc(100vh-120px-80px)]">
          <div className="container mx-auto px-4 pt-6 pb-24">
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-charcoal">Overview</h2>
                  <Badge className={getStatusBadgeClass(project.status)}>{project.status}</Badge>
                </div>
                <div className="text-sm text-gray-700 space-y-1 mb-4">
                  <p><strong>Scheduled:</strong> {project.schedule_date ? formatDate(project.schedule_date) : 'N/A'}</p>
                  <p className={cn(isOverdue && "text-red-600 font-semibold")}>
                    <strong>Follow Up:</strong> {project.follow_up_date ? formatDate(project.follow_up_date) : 'N/A'}
                    {isOverdue && <span className="ml-2 text-xs">(Overdue)</span>}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">Work Order Progress</p>
                  <Progress value={getProgressBarValue(project.status)} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Pending</span>
                    <span>Scheduled</span>
                    <span>On-Site Complete</span>
                    <span>Complete</span>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="related">Related</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <ProjectDetailsSection title="Work Summary" defaultOpen>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <p className="col-span-full"><strong>Summary:</strong> {project.details?.summary || 'N/A'}</p>
                      <p className="col-span-full"><strong>Instructions:</strong> {project.details?.instructions || 'N/A'}</p>
                      <p><strong>Work No.:</strong> {project.details?.work_no || 'N/A'}</p>
                      <p><strong>Field Ops Rep:</strong> {project.details?.field_ops_rep || 'N/A'}</p>
                      <p><strong>Service Order:</strong> {project.details?.service_order || 'N/A'}</p>
                      <div className="flex items-center gap-2"><strong>Work Type:</strong><Badge>{project.work_type || 'N/A'}</Badge></div>
                      <p><strong>Additional Visit Needed:</strong> {project.details?.additional_visit_needed ? 'Yes' : 'No'}</p>
                      <p><strong>Brand:</strong> {project.details?.brand || 'N/A'}</p>
                    </div>
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Schedule & Delay Info">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <p><strong>Arrival Window:</strong> {project.details?.arrival_window_start || 'N/A'} - {project.details?.arrival_window_end || 'N/A'}</p>
                      <p><strong>Duration:</strong> {project.details?.duration || 'N/A'} {project.details?.duration_type || ''}</p>
                      <p><strong>Date Delayed:</strong> {project.details?.date_service_delayed ? formatDate(project.details.date_service_delayed) : 'N/A'}</p>
                      <p><strong>Reason for Delay:</strong> {project.details?.reason_for_delay || 'N/A'}</p>
                      <p><strong>Contact Attempts:</strong> {project.details?.contact_attempt_counter || 0}</p>
                      <p><strong>Time Delayed:</strong> {project.details?.time_service_delayed || 'N/A'}</p>
                      <p><strong>Date Scheduled:</strong> {project.details?.date_scheduled ? formatDate(project.details.date_scheduled) : 'N/A'}</p>
                    </div>
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Customer Info">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <p><strong>Project Name:</strong> {project.name || 'N/A'}</p>
                      <p><strong>Account:</strong> {project.customer_contact_info?.account || 'N/A'}</p>
                      <p><strong>Contact:</strong> {project.customer_contact_info?.contact_name || 'N/A'}</p>
                      <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-600" /><a href={`tel:${project.customer_contact_info?.home_phone}`} className="text-blue-600 underline">{project.customer_contact_info?.home_phone || 'N/A'}</a></p>
                      <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-600" /><a href={`tel:${project.customer_contact_info?.mobile_phone}`} className="text-blue-600 underline">{project.customer_contact_info?.mobile_phone || 'N/A'}</a></p>
                      <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-600" /><a href={`mailto:${project.customer_contact_info?.email}`} className="text-blue-600 underline">{project.customer_contact_info?.email || 'N/A'}</a></p>
                      <p className="col-span-full flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-600" /><a href={`https://maps.google.com/?q=${encodeURIComponent(project.address || '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{project.address || 'N/A'}</a></p>
                    </div>
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Seller Info">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <p><strong>Company:</strong> {project.seller_contact_info?.company || 'N/A'}</p>
                      <p><strong>Contact:</strong> {project.seller_contact_info?.contact_name || 'N/A'}</p>
                      <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-600" /><a href={`tel:${project.seller_contact_info?.phone}`} className="text-blue-600 underline">{project.seller_contact_info?.phone || 'N/A'}</a></p>
                      <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-600" /><a href={`mailto:${project.seller_contact_info?.email}`} className="text-blue-600 underline">{project.seller_contact_info?.email || 'N/A'}</a></p>
                      <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-600" /><a href={`mailto:${project.seller_contact_info?.secondary_email}`} className="text-blue-600 underline">{project.seller_contact_info?.secondary_email || 'N/A'}</a></p>
                      <p className="col-span-full"><strong>Address:</strong> {project.seller_contact_info?.address || 'N/A'}</p>
                    </div>
                  </ProjectDetailsSection>
                </TabsContent>
                <TabsContent value="related" className="space-y-4 mt-4">
                  <ProjectDetailsSection title="Line Items" defaultOpen>
                    {windowItems.length === 0 ? <div className="text-center py-10 bg-white rounded-lg border border-dashed"><p className="text-gray-500">No line items for this project.</p></div> : windowItems.map((item) => <LineItemDisplay key={item.id} windowItem={item} />)}
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Payment Info">
                    {project.payment_info && (project.payment_info.billed_surcharges !== undefined || project.payment_info.payment_status) ? <Table><TableHeader><TableRow><TableHead>Detail</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="font-medium">Billed Surcharges</TableCell><TableCell><DollarSign className="inline h-4 w-4" />{project.payment_info.billed_surcharges?.toFixed(2) || '0.00'}</TableCell></TableRow><TableRow><TableCell className="font-medium">Payment Status</TableCell><TableCell>{project.payment_info.payment_status || 'N/A'}</TableCell></TableRow></TableBody></Table> : <p className="text-gray-500">No payment information available.</p>}
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Events">
                    {projectEvents.length > 0 ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Time</TableHead><TableHead>Project</TableHead></TableRow></TableHeader><TableBody>{projectEvents.map((event) => <TableRow key={event.id}><TableCell>{format(parseISO(event.event_date), 'MMM dd, yyyy')}</TableCell><TableCell>{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</TableCell><TableCell>{event.event_time || event.appointment_window ? `${event.event_time || ''} ${event.appointment_window ? `(${event.appointment_window} hrs)` : ''}`.trim() : 'N/A'}</TableCell><TableCell>{event.projects?.customer_name || event.projects?.name || 'N/A'}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-gray-500">No events recorded for this project.</p>}
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Related Work Orders">
                    {project.related_items?.related_work_orders && project.related_items.related_work_orders.length > 0 ? <Table><TableHeader><TableRow><TableHead>Work Order #</TableHead><TableHead>Name</TableHead></TableRow></TableHeader><TableBody>{project.related_items.related_work_orders.map((wo, index) => <TableRow key={index}><TableCell>{wo.id.substring(0, 8)}...</TableCell><TableCell><a href={`/work-order?id=${wo.id}`} className="text-blue-600 underline">{wo.name}</a></TableCell></TableRow>)}</TableBody></Table> : <p className="text-gray-500">No related work orders.</p>}
                  </ProjectDetailsSection>
                  <ProjectDetailsSection title="Files">
                    {project.related_items?.linked_files && project.related_items.linked_files.length > 0 ? <Table><TableHeader><TableRow><TableHead>File Name</TableHead><TableHead>Link</TableHead></TableRow></TableHeader><TableBody>{project.related_items.linked_files.map((file, index) => <TableRow key={index}><TableCell>{file.name}</TableCell><TableCell><a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View File</a></TableCell></TableRow>)}</TableBody></Table> : <p className="text-gray-500">No linked files.</p>}
                  </ProjectDetailsSection>
                </TabsContent>
                <TabsContent value="history" className="space-y-4 mt-4">
                  {projectEvents.length === 0 ? <div className="text-center py-10 bg-white rounded-lg border border-dashed"><p className="text-gray-500">No history available for this project.</p></div> : projectEvents.map((event) => <div key={event.id} className="border rounded-lg p-3 bg-gray-50"><p className="text-sm font-medium text-gray-800">{event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}</p><p className="text-xs text-gray-500 mt-1">Date: {format(parseISO(event.event_date), 'MMM dd, yyyy')}{event.event_time && ` | Time: ${event.event_time}`}{event.appointment_window && ` | Window: ${event.appointment_window} hrs`}</p>{event.projects?.customer_name && <p className="text-xs text-gray-500">Project: {event.projects.customer_name}</p>}</div>)}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/30 backdrop-blur-lg p-4 border-t border-gray-200/50 z-50 shadow-lg pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="container mx-auto flex justify-center items-center">
          {project.status === 'Pending Acceptance' && (
            <Button 
              className="bg-green-600 text-white hover:bg-green-700 w-full max-w-xs" 
              size="lg" 
              onClick={handleAcceptProject}
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              Accept Project
            </Button>
          )}
          {(project.status === 'Pending Schedule' || project.status === 'Scheduled') && (
            project.work_type === 'Measure' ? (
              <Button
                className="bg-black text-white hover:bg-black/80 w-full max-w-xs"
                size="lg"
                onClick={handleMeasureEntry}
              >
                <Ruler className="mr-2 h-5 w-5" />
                Measure Entry
              </Button>
            ) : (
              <Button
                className="bg-black text-white hover:bg-black/80 w-full max-w-xs"
                size="lg"
                onClick={() => setIsScheduleDialogOpen(true)}
              >
                <CalendarIcon className="mr-2 h-5 w-5" />
                {project.schedule_date ? 'Reschedule' : 'Schedule'}
              </Button>
            )
          )}
          {project.status === 'On-Site Complete' && (
            <Button
              className="bg-black text-white hover:bg-black/80 w-full max-w-xs"
              size="lg"
              onClick={handleSubmitMeasure}
              disabled={isSubmittingMeasure}
            >
              {isSubmittingMeasure ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
              Submit Measure
            </Button>
          )}
        </div>
      </footer>

      <CommentsHistorySheet
        isOpen={isCommentsSheetOpen}
        onOpenChange={handleCommentsSheetOpen}
        projectId={projectId}
      />

      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Schedule Project</DialogTitle>
            <DialogDescription>
              Select a date, time, and appointment window for "{project.customer_name || project.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
          <DialogFooter>
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
    </div>
  );
}