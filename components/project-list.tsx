"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ProjectCard } from "./project-card";
import type { ProjectRecord } from "@/app/projects/page";
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

interface ProjectListProps {
  projects: ProjectRecord[];
  onDeleteProject: (projectId: string) => Promise<void>;
  onUpdateProjects: () => void;
}

export function ProjectList({ projects, onDeleteProject, onUpdateProjects }: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<ProjectRecord | null>(null);

  // Placeholder states for filters
  const [workType, setWorkType] = useState('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    // Search logic
    if (searchQuery) {
      const lowerCaseSearchQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.customer_name?.toLowerCase().includes(lowerCaseSearchQuery) ||
        project.seller_name?.toLowerCase().includes(lowerCaseSearchQuery) ||
        project.work_order_number?.toLowerCase().includes(lowerCaseSearchQuery) ||
        project.name.toLowerCase().includes(lowerCaseSearchQuery)
      );
    }

    // Filter logic
    if (workType !== 'all') {
      filtered = filtered.filter(project => project.work_type === workType);
    }
    // if (dateRange.from || dateRange.to) { ... }

    // Sort oldest to newest by created_at date
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return filtered;
  }, [projects, searchQuery, workType, dateRange]);

  const handleDeleteConfirm = async () => {
    if (projectToDelete) {
      await onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <Input
            type="text"
            placeholder="Search by Customer, Seller, WO #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Filters</h4>
                <p className="text-sm text-muted-foreground">
                  Refine your project list.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="work-type">Work Type</Label>
                  <Select value={workType} onValueChange={setWorkType}>
                    <SelectTrigger id="work-type" className="col-span-2 h-8">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Measure">Measure</SelectItem>
                      <SelectItem value="Install">Install</SelectItem>
                      <SelectItem value="Service Call">Service Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label>Date Range</Label>
                  <div className="col-span-2 space-y-2">
                    <DatePicker
                      id="date-from"
                      value={dateRange.from}
                      onChange={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      label=""
                      labelColor="hidden"
                    />
                    <DatePicker
                      id="date-to"
                      value={dateRange.to}
                      onChange={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      label=""
                      labelColor="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {filteredAndSortedProjects.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed">
          <h2 className="text-lg font-semibold text-gray-700">No Projects Found</h2>
          <p className="text-gray-500 mt-1">No projects match your current criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={setProjectToDelete} onUpdate={onUpdateProjects} />
          ))}
        </div>
      )}

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project "{projectToDelete?.name}" and ALL its associated window measurements. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}