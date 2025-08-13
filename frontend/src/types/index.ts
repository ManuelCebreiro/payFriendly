export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  new_password: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  payment_amount: number;
  payment_frequency: string;
  public_id: string;
  owner_id: number;
  created_at: string;
  is_active: boolean;
}

export interface GroupWithStats extends Group {
  total_participants: number;
  total_payments: number;
  next_payment_due?: string;
}

export interface GroupCreate {
  name: string;
  description?: string;
  payment_amount: number;
  payment_frequency: string;
}

export interface GroupUpdate {
  name?: string;
  description?: string;
  payment_amount?: number;
  payment_frequency?: string;
}

export interface Participant {
  id: number;
  user_id?: number;
  group_id: number;
  guest_name?: string;
  guest_email?: string;
  joined_at: string;
  is_active: boolean;
  user?: User;
}

export interface Payment {
  id: number;
  user_id?: number;
  participant_id?: number;
  group_id: number;
  amount: number;
  payment_date: string;
  receipt_url?: string;
  notes?: string;
  is_verified: boolean;
  user?: User;
  participant?: Participant;
}

export interface PaymentCreate {
  group_id: number;
  amount: number;
  notes?: string;
  receipt?: File;
}

export interface DashboardStats {
  total_groups: number;
  total_payments: number;
  pending_payments: number;
  recent_payments: Payment[];
}

export interface PublicGroupView {
  name: string;
  description?: string;
  payment_amount: number;
  payment_frequency: string;
  total_participants: number;
  recent_payments: Payment[];
}

export interface PublicGroupInfo {
  name: string;
  description?: string;
  payment_amount: number;
  payment_frequency: string;
  total_participants: number;
  current_period_collected: number;
  pending_amount: number;
}

export interface PublicOverdueParticipant {
  name: string;
  days_since_last: number;
  last_payment_date?: string;
  group_name: string;
  payment_frequency: string;
}

export interface PublicOverdueResponse {
  group_info: PublicGroupInfo;
  overdue_participants: PublicOverdueParticipant[];
}

export interface ApiError {
  detail: string;
}

export interface Notification {
  type: "overdue_payment" | "unverified_payments" | "info";
  title: string;
  message: string;
  group_id?: number;
  priority: "low" | "medium" | "high";
}

export interface PaymentStats {
  total_payments: number;
  payment_count: number;
  verified_payments: number;
  user_payments: {
    user_name: string;
    total_amount: number;
    payment_count: number;
  }[];
}

export interface ActivityItem {
  type: "payment";
  id: number;
  user_name: string;
  group_name: string;
  amount: number;
  date: string;
  is_own_payment: boolean;
}

export interface GroupSummary {
  group_name: string;
  group_id: number;
  expected_amount: number;
  payment_frequency: string;
  total_paid: number;
  payment_count: number;
  last_payment?: string;
  days_since_last: number;
  is_due: boolean;
}

// Form validation types
export interface FormErrors {
  [key: string]: string | undefined;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// File upload
export interface FileUploadResponse {
  url: string;
  public_id: string;
}

// Theme
export type Theme = "light" | "dark" | "system";

// Navigation
export interface NavItem {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  current?: boolean;
}

// Modal
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Toast
export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// Guest participant types
export interface GuestParticipantCreate {
  guest_name: string;
  guest_email?: string;
}

export interface LinkGuestRequest {
  participant_id: number;
}

// Group detail types
export interface GroupDetail extends Group {
  participants: Participant[];
  payments: Payment[];
  total_participants: number;
  total_payments: number;
  pending_amount: number;
  owner: User;
}

// Monthly stats
export interface MonthlyStats {
  month: string;
  year: number;
  total_payments: number;
  payment_count: number;
  pending_payments: number;
  participants_paid: number;
  total_participants: number;
}

// Overdue participants
export interface OverdueParticipant {
  participant: Participant;
  days_overdue: number;
  last_payment_date?: string;
  amount_owed: number;
}

// Next payers (próximos pagadores del siguiente período)
export interface NextPayer {
  name: string;
  group_name: string;
  group_id: number;
  participant_id: number;
  days_since_last: number;
  last_payment_date?: string;
  amount_due: number;
}

// Last payers (últimos pagadores)
export interface LastPayerItem {
  name: string;
  group_name: string;
  group_id: number;
  participant_id?: number;
  amount: number;
  payment_date: string;
}

// Reassign payer response
export interface ReassignPayerResponse {
  message: string;
  skipped_participant: NextPayer;
  next_participant: NextPayer | null;
  updated_ranking: NextPayer[];
}
