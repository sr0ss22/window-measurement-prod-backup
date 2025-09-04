import { Suspense } from 'react';
import ClientWorkOrderPage from './ClientWorkOrderPage';
import { Skeleton } from '@/components/ui/skeleton';

export default function WorkOrderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-screen" />}>
      <ClientWorkOrderPage />
    </Suspense>
  );
}