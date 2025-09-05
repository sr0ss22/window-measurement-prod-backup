"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/unified-auth-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/types/notification';
import { toast } from '@/components/ui/use-toast';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    // TODO: Implement notifications with CPQ API or local storage
    // For now, show empty state
    setNotifications([]);
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    // TODO: Implement unread count with CPQ API or local storage
    // For now, show 0
    setUnreadCount(0);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!user) return;

    // TODO: Implement real-time notifications with CPQ API or WebSocket
    // For now, just fetch once
    fetchNotifications();
    fetchUnreadCount();
  }, [user, fetchNotifications, fetchUnreadCount]);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      // TODO: Implement marking notifications as read with CPQ API
      // For now, just reset the count
      setUnreadCount(0);
    }
  };

  const handleDelete = async (id: string) => {
    // TODO: Implement deleting notifications with CPQ API
    // For now, just remove from local state
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handlePinToggle = async (id: string, isPinned: boolean) => {
    // TODO: Implement pinning notifications with CPQ API
    // For now, just re-fetch to update UI
    fetchNotifications();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 flex flex-col w-full sm:max-w-md">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <NotificationItem key={notification.id} notification={notification} onDelete={handleDelete} onPinToggle={handlePinToggle} />
            ))
          ) : (
            <p className="p-4 text-center text-gray-500">You're all caught up!</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}