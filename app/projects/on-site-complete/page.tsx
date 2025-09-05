"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/unified-auth-context";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { ProjectList } from "@/components/project-list";
import type { ProjectRecord } from "@/app/projects/page";
import { UserNav } from "@/components/user-nav";
import { useMobile } from "@/hooks/use-mobile";
import { HardHat, ArrowLeft, Home, ClipboardList, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OnSiteCompletePage() {
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useMobile();

  const fetchProjects = useCallback(async () => {
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
      .eq('user_id', user.id)
      .eq('company_id', userCompanyId) // Filter by company_id
      .eq('status', 'On-Site Complete');

    if (error) {
      console.error("Error fetching on-site complete projects:", error);
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
    <div className="relative min-h-screen bg-black">
      <main className="relative z-10">
        <div className="h-[150px] md:h-[120px]">
          <div className="ios:pt-[env(safe-area-inset-top)] h-full">
            <div className="container mx-auto px-4 text-white flex justify-between items-center h-full">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <HardHat className="h-7 w-7 text-primary-foreground" />
                <h1 className="text-lg font-bold">On-Site Complete</h1>
              </div>
              <UserNav />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 min-h-[calc(100vh-150px-64px)] md:min-h-[calc(100vh-120px-64px)]">
          <div className="container mx-auto px-4 pt-6 pb-20">
            {!isMobile && <p className="text-lg text-gray-600 mb-6">Projects where on-site measurement is complete.</p>}
            <ProjectList
              projects={projects}
              onDeleteProject={handleDeleteProject}
              onUpdateProjects={fetchProjects}
            />
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
          <Link href="/projects/calendar" className="flex flex-col items-center text-gray-600 hover:text-primary transition-colors">
            <Calendar className="h-6 w-6" />
            <span className="text-xs font-medium">Calendar</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}