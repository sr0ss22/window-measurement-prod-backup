import { Suspense } from "react";
import ProductHelperContent from "./content";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductHelperPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    }>
      <ProductHelperContent />
    </Suspense>
  );
}