"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/unified-auth-context";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { ProjectList } from "@/components/project-list";
import type { ProjectRecord } from "@/app/projects/page";
import { UserNav } from "@/components/user-nav";

export default function ActiveWorkPage() {
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    // RLS ensures only projects from the user's company are returned.
    const { data, error } = await supabase
      .from('projects')
      .select('*');

    if (error) {
      console.error("Error fetching active projects:", error);
      toast({ title: "Error", description: "Could not fetch your projects.", variant: "destructive" });
    } else {
      setProjects(data as ProjectRecord[]);
    }
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchProjects();
    }
  }, [user, isAuthLoading, router, fetchProjects]);

  const handleDeleteProject = async (projectId: string) => {
    await supabase.from('window_measurements').delete().eq('project_id', projectId);
    await supabase.from('global_form_data').delete().eq('project_id', projectId);
    await supabase.from('projects').delete().eq('id', projectId);
    toast({ title: "Success", description: "Project deleted." });
    fetchProjects();
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-background text-foreground py-4 px-6 shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-charcoal">Active Work</h1>
          <UserNav />
        </div>
      </div>
      <div className="container mx-auto py-6 px-4">
        <p className="text-lg text-gray-600 mb-6">All your projects, regardless of status.</p>
        <ProjectList
          projects={projects}
          onDeleteProject={handleDeleteProject}
          onUpdateProjects={fetchProjects}
        />
      </div>
    </main>
  );
}