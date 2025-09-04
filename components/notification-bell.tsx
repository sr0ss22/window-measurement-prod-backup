"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/types/notification';
import { toast } from '@/components/ui/use-toast';

export function NotificationBell() {
  const { user, supabase } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id ( id, first_name, last_name, avatar_url ),
        project:project_id ( id, name, customer_name, work_order_number ),
        comment:comment_id ( id, comment_text )
      `)
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
    } else {
      setNotifications(data as Notification[]);
    }
  }, [user, supabase]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('count', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    if (error) {
      console.error("Error fetching unread count:", error);
    } else {
      setUnreadCount(count || 0);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          fetchNotifications();
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchNotifications, fetchUnreadCount]);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      
      if (error) {
        console.error("Error marking notifications as read:", error);
      } else {
        setUnreadCount(0);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Could not delete notification.", variant: "destructive" });
    } else {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const handlePinToggle = async (id: string, isPinned: boolean) => {
    const { error } = await supabase.from('notifications').update({ is_pinned: !isPinned }).eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Could not update pin status.", variant: "destructive" });
    } else {
      fetchNotifications(); // Re-fetch to re-order
    }
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