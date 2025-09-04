"use client";

import { useSearchParams } from "next/navigation";
import WorkOrderDetailContent from "./content";

export default function ClientWorkOrderPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");

  if (!projectId) {
    return (
      <main className="flex items-center justify-center h-screen p-4 text-center text-gray-500">
        No work order ID provided. Please select a project to view its details.
      </main>
    );
  }

  return <WorkOrderDetailContent projectId={projectId} />;
}