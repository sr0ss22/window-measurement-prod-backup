export interface Notification {
  id: string;
  is_read: boolean;
  is_pinned: boolean;
  created_at: string;
  notification_type: 'new_comment';
  
  // Joined data from other tables
  actor: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  
  project: {
    id: string;
    name: string;
    customer_name?: string | null;
    work_order_number?: string | null;
  } | null;
  
  comment: {
    id: string;
    comment_text: string;
  } | null;
}