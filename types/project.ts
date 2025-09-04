export interface ProjectRecord {
  id: string;
  name: string;
  customer_name: string | null;
  schedule_date: string | null;
  seller_name: string | null;
  work_order_number: string | null;
  created_at: string;
  updated_at: string;
  status: 'Pending Acceptance' | 'Pending Schedule' | 'Scheduled' | 'On-Site Complete' | 'Complete';
  address: string | null;
  phone: string | null;
  follow_up_date: string | null;
  work_type: 'Measure' | 'Install' | 'Service Call' | null;
  
  // New JSONB fields for detailed information
  details: {
    summary?: string;
    instructions?: string;
    work_no?: string;
    field_ops_rep?: string;
    service_order?: string;
    work_type?: 'Install' | 'Measure' | 'Service';
    additional_visit_needed?: boolean;
    brand?: string;
    arrival_window_start?: string;
    arrival_window_end?: string;
    duration?: number;
    duration_type?: string;
    date_service_delayed?: string;
    reason_for_delay?: string;
    contact_attempt_counter?: number;
    time_service_delayed?: string;
    date_scheduled?: string;
  } | null;
  customer_contact_info: {
    account?: string;
    contact_name?: string;
    home_phone?: string;
    mobile_phone?: string;
    email?: string;
  } | null;
  seller_contact_info: {
    company?: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    secondary_email?: string;
    address?: string;
  } | null;
  payment_info: {
    billed_surcharges?: number;
    payment_status?: string;
  } | null;
  related_items: {
    linked_files?: { name: string; url: string; }[];
    related_work_orders?: { id: string; name: string; }[];
    service_calls?: { id: string; description: string; }[];
  } | null;
}

export interface ProjectEvent {
  id: string;
  project_id: string;
  event_date: string;
  event_time: string | null;
  appointment_window: string | null;
  event_type: string;
  projects: { // Joined project data
    name: string;
    customer_name: string | null;
    work_order_number: string | null;
    status: 'Pending Acceptance' | 'Pending Schedule' | 'Scheduled' | 'On-Site Complete' | 'Complete';
  } | null;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  user_name?: string; // Renamed from user_email for clarity
  avatar_url?: string; // New field
  initials?: string;
}