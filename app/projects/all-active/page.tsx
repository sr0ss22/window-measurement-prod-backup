"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/unified-auth-context";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { ProjectList } from "@/components/project-list";
import type { ProjectRecord } from "@/app/projects/page";
import { UserNav } from "@/components/user-nav";
import { useMobile } from "@/hooks/use-mobile";
import { ClipboardList, ArrowLeft, Home, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { workOrdersService } from "@/apiUtils/services/workOrdersService";

export default function AllActiveWorkPage() {
  const { user, accessToken, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useMobile();
  const [activeTab, setActiveTab] = useState('accept');

  const fetchProjects = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);

    try {
      const response = await workOrdersService.getWorkOrders(
        {
          page: 1,
          pageSize: 100,
          status: 'Active',
        },
        accessToken
      );

      // Transform work orders to ProjectRecord format
      const transformedProjects: ProjectRecord[] = response.workOrders.map((workOrder) => ({
        id: workOrder.id,
        name: workOrder.name,
        customer_name: workOrder.customerName,
        schedule_date: workOrder.scheduleDate,
        seller_name: workOrder.sellerName,
        work_order_number: workOrder.workOrderNumber,
        created_at: workOrder.createdAt,
        updated_at: workOrder.updatedAt,
        status: workOrder.status as any,
        address: workOrder.address,
        phone: workOrder.phone,
        follow_up_date: workOrder.followUpDate,
        work_type: workOrder.workType as any,
        details: workOrder.details,
        customer_contact_info: workOrder.customer_contact_info,
        seller_contact_info: workOrder.seller_contact_info,
        payment_info: workOrder.payment_info,
        related_items: workOrder.related_items,
      }));

      console.log('Transformed projects for cards:', transformedProjects);
      console.log('First project work order number:', transformedProjects[0]?.work_order_number);
      console.log('First project schedule date:', transformedProjects[0]?.schedule_date);
      console.log('First project seller name:', transformedProjects[0]?.seller_name);

      setProjects(transformedProjects);
    } catch (error: any) {
      console.error('Error fetching work orders:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch work orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthLoading && !accessToken) {
      router.push('/login');
    } else if (accessToken) {
      fetchProjects();
    }
  }, [accessToken, isAuthLoading, router, fetchProjects]);

  const handleDeleteProject = async (projectId: string) => {
    // Note: Delete functionality would need to be implemented via CPQ API
    toast({ title: "Delete Feature", description: "Delete functionality coming soon!" });
  };

  const filteredProjects = useMemo(() => {
    switch (activeTab) {
      case 'accept':
        return projects.filter(p => p.status === 'Pending Acceptance');
      case 'pending':
        return projects.filter(p => p.status === 'Pending Schedule');
      case 'scheduled':
        return projects.filter(p => p.status === 'Scheduled');
      case 'on-site':
        return projects.filter(p => p.status === 'On-Site Complete');
      default:
        return projects;
    }
  }, [projects, activeTab]);

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
                <ClipboardList className="h-7 w-7 text-primary-foreground" />
                <h1 className="text-lg font-bold">All Active Work</h1>
              </div>
              <UserNav />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 min-h-[calc(100vh-150px-64px)] md:min-h-[calc(100vh-120px-64px)]">
          <div className="container mx-auto px-4 pt-6 pb-20">
            {!isMobile && <p className="text-lg text-gray-600 mb-6">All projects that are not yet marked as 'Complete'.</p>}
            
            <Tabs defaultValue="accept" onValueChange={setActiveTab} className="w-full mb-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="accept">Accept</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="on-site">On-site</TabsTrigger>
              </TabsList>
            </Tabs>

            <ProjectList
              projects={filteredProjects}
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
          <Link href="/projects/all-active" className="flex flex-col items-center text-primary font-bold transition-colors">
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