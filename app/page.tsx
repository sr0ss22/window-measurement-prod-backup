import { Suspense } from "react";
import HomeContent from "./home-content"; // Corrected import path
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for fallback

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}