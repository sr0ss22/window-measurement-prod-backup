"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex justify-center items-center min-h-screen bg-black", className)}>
      <div className="relative w-32 h-32">
        <Image
          src="https://dntfkxqtnwijuskdpkhq.supabase.co/storage/v1/object/public/logos/Brite-Install-Logo.png"
          alt="Loading..."
          width={128}
          height={128}
          className="animate-pulse"
          priority // Preload the logo
        />
      </div>
    </div>
  );
}