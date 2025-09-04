"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, CalendarCheck, CheckCircle, Circle, Filter, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO, isPast, isToday } from "date-fns";
import type { ProjectRecord } from "@/app/projects/page";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMobile } from "@/hooks/use-mobile"; // Import useMobile
import { DndContext, closestCorners, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities"; // Import CSS for drag-and-drop styling
import { createPortal } from "react-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { formatDate } from "@/utils/date-formatter"; // Import formatDate

interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  follow_up_date: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue'; // Added 'in-progress'
  created_at: string;
  updated_at: string;
  projects?: { name: string; customer_name: string | null; } | null; // Joined project data
}

interface TaskManagerProps {
  allProjects: ProjectRecord[]; // Pass all projects for task association
  onUpdateProjects: () => void; // Callback to refresh project list if needed
}

// Kanban Column IDs
type KanbanColumnId = 'pending' | 'in-progress' | 'completed' | 'overdue'; // Added 'in-progress'

// Kanban Column Component
interface KanbanColumnProps {
  id: KanbanColumnId;
  title: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onToggleTaskStatus: (task: Task) => void;
}

const KanbanColumn = ({ id, title, tasks, onEditTask, onDeleteTask, onToggleTaskStatus }: KanbanColumnProps) => {
  return (
    <div className="flex flex-col bg-gray-100 rounded-lg p-3 min-w-[280px] max-w-[350px] flex-1">
      <h3 className="font-semibold text-lg mb-3 text-center">{title} ({tasks.length})</h3>
      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

// Task Card Component (for Kanban and mobile list)
interface TaskCardProps {
  task: Task;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onToggleTaskStatus: (task: Task) => void;
}

const TaskCard = ({ task, onEditTask, onDeleteTask, onToggleTaskStatus }: TaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "Task", task }, // Added data property for DragOverlay
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg p-3 flex flex-col gap-2 bg-white shadow-sm relative", // Added relative, flex-col
        task.status === 'overdue' && "border-l-4 border-status-red-subtle bg-status-red-subtle/20",
        task.status === 'completed' && "opacity-70"
      )}
    >
      <div className="absolute top-2 right-2"> {/* Badge position */}
        <Badge
          variant="default"
          className={cn(
            "px-2 py-0.5 text-xs", // Smaller badge
            task.status === 'pending' && 'bg-blue-500', // Keep blue for pending
            task.status === 'completed' && 'bg-status-green-subtle text-status-green-subtle-foreground',
            task.status === 'overdue' && 'bg-status-red-subtle text-status-red-subtle-foreground',
            task.status === 'in-progress' && 'bg-status-yellow-subtle text-status-yellow-subtle-foreground'
          )}
        >
          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
        </Badge>
      </div>

      <div className="flex items-center gap-2"> {/* Title and status toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleTaskStatus(task)}
          className={cn(
            "h-6 w-6",
            task.status === 'completed' ? "text-green-600" : "text-gray-400 hover:text-green-500"
          )}
          title={task.status === 'completed' ? "Mark as Pending" : "Mark as Completed"}
        >
          {task.status === 'completed' ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </Button>
        <p className={cn("font-semibold text-gray-800", task.status === 'completed' && "line-through")}>
          {task.title}
        </p>
      </div>
      {task.description && <p className="text-sm text-gray-600">{task.description}</p>}
      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
        <span>Follow up: {formatDate(task.follow_up_date)}</span>
        {task.assigned_to && <span>Assigned to: {task.assigned_to}</span>}
        {task.project_id && (
          <span>Project: {task.projects?.customer_name || task.projects?.name || 'N/A'}</span>
        )}
      </div>

      <div className="flex justify-end space-x-1 mt-auto" {...attributes} {...listeners}> {/* Buttons at bottom right, drag handle here */}
        <Button variant="ghost" size="icon" onClick={() => onEditTask(task)} className="h-6 w-6">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDeleteTask(task)} className="h-6 w-6">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
};


export function TaskManager({ allProjects, onUpdateProjects }: TaskManagerProps) {
  const { user, supabase } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<Task> | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const isMobile = useMobile();

  // DND-Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px to activate drag
      },
    })
  );

  // Filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'overdue'>('pending');
  const [filterAssignedTo, setFilterAssignedTo] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch user's company_id first
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData?.company_id) {
      console.error("Error fetching user's company ID for tasks:", profileError);
      toast({ title: "Error", description: "Could not retrieve your company information.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    const userCompanyId = profileData.company_id;

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        projects (
          name,
          customer_name
        )
      `)
      .eq('user_id', user.id)
      .eq('projects.company_id', userCompanyId) // Filter by company_id in joined projects
      .order('follow_up_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: "Could not fetch your tasks.", variant: "destructive" });
    } else {
      // Update status for overdue tasks on fetch
      const updatedTasks = data.map(task => {
        const taskDate = parseISO(task.follow_up_date);
        // Only mark as overdue if current status is 'pending' or 'in-progress'
        if ((task.status === 'pending' || task.status === 'in-progress') && isPast(taskDate) && !isToday(taskDate)) {
          return { ...task, status: 'overdue' };
        }
        return task;
      });
      setTasks(updatedTasks as Task[]);
    }
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user, fetchTasks]);

  const handleCreateTask = () => {
    setCurrentTask({
      title: '',
      description: '',
      assigned_to: user?.email || '',
      follow_up_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'pending',
      project_id: null,
    });
    setIsTaskDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setCurrentTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleSaveTask = async () => {
    if (!currentTask?.title || !currentTask?.follow_up_date) {
      toast({ title: "Validation Error", description: "Title and Follow Up Date are required.", variant: "destructive" });
      return;
    }
    if (!user) return;

    setIsLoading(true);
    let error;
    if (currentTask.id) {
      // Update existing task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          title: currentTask.title,
          description: currentTask.description,
          assigned_to: currentTask.assigned_to,
          follow_up_date: currentTask.follow_up_date,
          status: currentTask.status,
          project_id: currentTask.project_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentTask.id);
      error = updateError;
    } else {
      // Insert new task
      const { error: insertError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: currentTask.title,
          description: currentTask.description,
          assigned_to: currentTask.assigned_to,
          follow_up_date: currentTask.follow_up_date,
          status: currentTask.status,
          project_id: currentTask.project_id,
        });
      error = insertError;
    }

    if (error) {
      console.error("Error saving task:", error);
      toast({ title: "Error", description: "Could not save task.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task saved successfully." });
      setIsTaskDialogOpen(false);
      setCurrentTask(null);
      fetchTasks(); // Refresh tasks
      onUpdateProjects(); // Refresh projects in case a task was linked/unlinked
    }
    setIsLoading(false);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsLoading(true);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskToDelete.id);

    if (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Could not delete task.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task deleted successfully." });
      setTaskToDelete(null);
      fetchTasks(); // Refresh tasks
    }
    setIsLoading(false);
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (!user) return;
    setIsLoading(true);
    // Toggle between 'pending' and 'completed' for the button
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id);

    if (error) {
      console.error("Error updating task status:", error);
      toast({ title: "Error", description: "Could not update task status.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Task marked as ${newStatus}.` });
      fetchTasks(); // Refresh tasks
    }
    setIsLoading(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as KanbanColumnId;

    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (taskToUpdate && taskToUpdate.status !== newStatus) {
      // Optimistic UI update
      setTasks(prevTasks => prevTasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ));

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        console.error("Error updating task status via drag and drop:", error);
        toast({ title: "Error", description: "Could not update task status.", variant: "destructive" });
        // Revert UI if update fails
        setTasks(prevTasks => prevTasks.map(t => 
          t.id === taskId ? { ...t, status: taskToUpdate.status } : t
        ));
      } else {
        toast({ title: "Success", description: `Task status updated to ${newStatus}.` });
      }
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
        const lowerCaseSearchQuery = searchQuery.toLowerCase();
        const searchMatch = searchQuery ? 
            task.title.toLowerCase().includes(lowerCaseSearchQuery) ||
            task.description?.toLowerCase().includes(lowerCaseSearchQuery) ||
            task.projects?.customer_name?.toLowerCase().includes(lowerCaseSearchQuery) ||
            task.projects?.name?.toLowerCase().includes(lowerCaseSearchQuery)
            : true;
        
        const assigneeMatch = filterAssignedTo !== 'all' ? task.assigned_to === filterAssignedTo : true;

        // For desktop, we also filter by status from the dropdown
        const statusMatch = !isMobile ? (filterStatus !== 'all' ? task.status === filterStatus : true) : true;

        return searchMatch && assigneeMatch && statusMatch;
    });
  }, [tasks, searchQuery, filterAssignedTo, filterStatus, isMobile]);

  const pendingTasks = useMemo(() => filteredTasks.filter(task => task.status === 'pending'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter(task => task.status === 'in-progress'), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter(task => task.status === 'completed'), [filteredTasks]);
  const overdueTasks = useMemo(() => filteredTasks.filter(task => task.status === 'overdue'), [filteredTasks]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    tasks.forEach(task => {
      if (task.assigned_to) {
        assignees.add(task.assigned_to);
      }
    });
    return Array.from(assignees);
  }, [tasks]);

  return (
    <>
      <Card className="border-2 border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-xl flex items-center gap-2 text-gray-800">
            <CalendarCheck className="h-6 w-6 text-charcoal" />
            My Tasks
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 space-y-3">
                <h4 className="font-medium">Filter Tasks</h4>
                {!isMobile && (
                  <div className="space-y-2">
                    <Label htmlFor="filter-status">Status</Label>
                    <Select value={filterStatus} onValueChange={(value: typeof filterStatus) => setFilterStatus(value)}>
                      <SelectTrigger id="filter-status">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="filter-assigned">Assigned To</Label>
                  <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
                    <SelectTrigger id="filter-assigned">
                      <SelectValue placeholder="Filter by assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueAssignees.map(assignee => (
                        <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={handleCreateTask} size={isMobile ? "icon" : "default"} className="h-8">
              <Plus className="h-4 w-4" /> {isMobile ? "" : "Create New Task"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {isLoading ? (
            <p className="text-gray-500">Loading tasks...</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              {isMobile ? (
                <Tabs defaultValue="due" className="w-full">
                  <div className="overflow-x-auto border-b">
                    <TabsList className="w-max p-0 bg-transparent gap-2">
                      <TabsTrigger value="due" className="rounded-none border-b-2 border-transparent bg-transparent p-4 shadow-none data-[state=active]:border-destructive data-[state=active]:text-destructive">
                        Due <Badge variant="destructive" className="ml-1.5">{overdueTasks.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="todo" className="rounded-none border-b-2 border-transparent bg-transparent p-4 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                        To Do <Badge variant="secondary" className="ml-1.5">{pendingTasks.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="doing" className="rounded-none border-b-2 border-transparent bg-transparent p-4 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                        Doing <Badge variant="secondary" className="ml-1.5">{inProgressTasks.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="done" className="rounded-none border-b-2 border-transparent bg-transparent p-4 shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none">
                        Done <Badge variant="secondary" className="ml-1.5">{completedTasks.length}</Badge>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="due" className="mt-4 space-y-3">
                    {overdueTasks.length === 0 ? <p className="text-gray-500 text-sm text-center py-4">No overdue tasks.</p> : <SortableContext items={overdueTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>{overdueTasks.map(task => <TaskCard key={task.id} task={task} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />)}</SortableContext>}
                  </TabsContent>
                  <TabsContent value="todo" className="mt-4 space-y-3">
                    {pendingTasks.length === 0 ? <p className="text-gray-500 text-sm text-center py-4">No tasks to do.</p> : <SortableContext items={pendingTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>{pendingTasks.map(task => <TaskCard key={task.id} task={task} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />)}</SortableContext>}
                  </TabsContent>
                  <TabsContent value="doing" className="mt-4 space-y-3">
                    {inProgressTasks.length === 0 ? <p className="text-gray-500 text-sm text-center py-4">No tasks in progress.</p> : <SortableContext items={inProgressTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>{inProgressTasks.map(task => <TaskCard key={task.id} task={task} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />)}</SortableContext>}
                  </TabsContent>
                  <TabsContent value="done" className="mt-4 space-y-3">
                    {completedTasks.length === 0 ? <p className="text-gray-500 text-sm text-center py-4">No completed tasks.</p> : <SortableContext items={completedTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>{completedTasks.map(task => <TaskCard key={task.id} task={task} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />)}</SortableContext>}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  <KanbanColumn id="overdue" title="Due" tasks={overdueTasks} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />
                  <KanbanColumn id="pending" title="To Do" tasks={pendingTasks} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />
                  <KanbanColumn id="in-progress" title="Doing" tasks={inProgressTasks} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />
                  <KanbanColumn id="completed" title="Done" tasks={completedTasks} onEditTask={handleEditTask} onDeleteTask={setTaskToDelete} onToggleTaskStatus={handleToggleTaskStatus} />
                </div>
              )}
            </DndContext>
          )}
        </CardContent>
      </Card>

      {createPortal(
        <DragOverlay>
          {currentTask && (
            <TaskCard
              task={currentTask as Task} // Cast to Task as it's being dragged
              onEditTask={handleEditTask}
              onDeleteTask={setTaskToDelete}
              onToggleTaskStatus={handleToggleTaskStatus}
            />
          )}
        </DragOverlay>,
        document.body
      )}

      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentTask?.id ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {currentTask?.id ? "Modify the details of your task." : "Add a new task to your list."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title <span className="text-rose-500">*</span></Label>
              <Input
                id="task-title"
                value={currentTask?.title || ''}
                onChange={(e) => setCurrentTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Call customer for follow-up"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={currentTask?.description || ''}
                onChange={(e) => setCurrentTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed notes about the task"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assigned-to">Assigned To</Label>
              <Input
                id="task-assigned-to"
                value={currentTask?.assigned_to || ''}
                onChange={(e) => setCurrentTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                placeholder="e.g., John Doe or email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-follow-up-date">Follow Up Date <span className="text-rose-500">*</span></Label>
              <DatePicker
                id="task-follow-up-date"
                value={currentTask?.follow_up_date ? parseISO(currentTask.follow_up_date) : undefined}
                onChange={(date) => setCurrentTask(prev => ({ ...prev, follow_up_date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                label=""
                labelColor="hidden"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-project">Associate with Project</Label>
              <Select
                value={currentTask?.project_id || "no-project"}
                onValueChange={(value) => setCurrentTask(prev => ({ ...prev, project_id: value === "no-project" ? null : value }))}
              >
                <SelectTrigger id="task-project">
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-project">None</SelectItem>
                  {allProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.customer_name || project.name} (WO#: {project.work_order_number || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={currentTask?.status || 'pending'}
                onValueChange={(value: typeof currentTask.status) => setCurrentTask(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem> {/* New status option */}
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue" disabled>Overdue (Automatic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTask} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task "{taskToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}