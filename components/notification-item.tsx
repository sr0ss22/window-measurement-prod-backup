"use client";

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/types/notification';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/utils/date-formatter';
import { Pin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onDelete: (id: string) => void;
  onPinToggle: (id: string, isPinned: boolean) => void;
}

export function NotificationItem({ notification, onDelete, onPinToggle }: NotificationItemProps) {
  const router = useRouter();
  const itemRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const actorName = `${notification.actor?.first_name || ''} ${notification.actor?.last_name || ''}`.trim() || 'Someone';
  const initials = `${notification.actor?.first_name?.charAt(0) || ''}${notification.actor?.last_name?.charAt(0) || ''}`.toUpperCase() || 'S';

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only main click
    setIsDragging(true);
    itemRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragX((prev) => prev + e.movementX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    itemRef.current?.releasePointerCapture(e.pointerId);

    const threshold = itemRef.current ? itemRef.current.offsetWidth * 0.3 : 100;

    if (dragX > threshold) {
      onPinToggle(notification.id, !notification.is_pinned);
    } else if (dragX < -threshold) {
      onDelete(notification.id);
    }
    
    setDragX(0);
  };

  const handleClick = () => {
    if (Math.abs(dragX) < 10) { // Prevent click on swipe
      if (notification.project?.id) {
        router.push(`/work-orders/${notification.project.id}`);
      }
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 w-full bg-blue-500 flex items-center justify-start px-4 text-white transition-opacity"
        style={{ opacity: Math.max(0, Math.min(1, dragX / 100)) }}
      >
        <Pin className="h-5 w-5 mr-2" />
        <span>{notification.is_pinned ? 'Unpin' : 'Pin'}</span>
      </div>
      <div
        className="absolute inset-y-0 right-0 w-full bg-red-500 flex items-center justify-end px-4 text-white transition-opacity"
        style={{ opacity: Math.max(0, Math.min(1, -dragX / 100)) }}
      >
        <span>Clear</span>
        <Trash2 className="h-5 w-5 ml-2" />
      </div>
      <div
        ref={itemRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "p-3 border-b flex items-start space-x-3 cursor-pointer transition-transform duration-200 ease-out bg-white",
          notification.is_pinned && "bg-blue-50",
          !notification.is_read && "bg-blue-50"
        )}
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={notification.actor?.avatar_url || undefined} alt={actorName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-gray-800"><span className="font-bold">{actorName}</span> commented</p>
            <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatRelativeTime(notification.created_at)}</p>
          </div>
          <p className="text-sm text-gray-800 mt-1">
            <span className="font-semibold">Customer: {notification.project?.customer_name || 'N/A'} | WO #{notification.project?.work_order_number || 'N/A'}</span>
          </p>
          <p className="text-sm text-gray-600 italic mt-1 whitespace-pre-wrap">"{notification.comment?.comment_text}"</p>
        </div>
      </div>
    </div>
  );
}