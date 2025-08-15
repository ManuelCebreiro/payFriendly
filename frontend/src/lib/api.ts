import axios, { AxiosError, AxiosResponse } from "axios";
import Cookies from "js-cookie";
// Toast notifications will be handled by components

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token expired or invalid
      Cookies.remove("access_token");
      window.location.href = "/login";
    } else if (status === 403) {
      // Error handling will be done by components
    } else if (status === 404) {
      // Error handling will be done by components
    } else if (status && status >= 500) {
      // Error handling will be done by components
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    api.post("/auth/login", credentials),

  register: (data: { email: string; password: string; full_name: string }) =>
    api.post("/auth/register", data),

  getProfile: () => api.get("/auth/me"),

  requestPasswordReset: (email: string) =>
    api.post("/auth/request-password-reset", { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post("/auth/reset-password", { token, new_password }),

  verifyResetToken: (token: string) =>
    api.post("/auth/verify-reset-token", null, { params: { token } }),
};

// Groups API
export const groupsApi = {
  getGroups: () => api.get("/groups/"),

  getGroup: (id: number) => api.get(`/groups/${id}`),

  createGroup: (data: {
    name: string;
    description?: string;
    payment_amount: number;
    payment_frequency: string;
  }) => api.post("/groups/", data),

  updateGroup: (
    id: number,
    data: {
      name?: string;
      description?: string;
      payment_amount?: number;
      payment_frequency?: string;
    }
  ) => api.put(`/groups/${id}`, data),

  deleteGroup: (id: number) => api.delete(`/groups/${id}`),

  getPublicGroup: (publicId: string) => api.get(`/groups/public/${publicId}`),

  joinGroup: (id: number) => api.post(`/groups/${id}/join`),

  leaveGroup: (id: number) => api.post(`/groups/${id}/leave`),

  getParticipants: (id: number) => api.get(`/groups/${id}/participants`),

  addGuestParticipant: (
    id: number,
    data: {
      guest_name: string;
      guest_email?: string;
    }
  ) => api.post(`/groups/${id}/add-guest`, { ...data, group_id: id }),

  linkGuestToUser: (id: number, participantId: number, userId?: number) =>
    api.post(
      `/groups/${id}/link-guest/${participantId}`,
      userId ? { user_id: userId } : undefined
    ),

  removeParticipant: (id: number, participantId: number) =>
    api.delete(`/groups/${id}/participants/${participantId}`),

  updateParticipant: (
    id: number,
    participantId: number,
    data: { guest_name?: string; guest_email?: string; is_active?: boolean }
  ) => api.put(`/groups/${id}/participants/${participantId}`, data),
};

// Payments API
export const paymentsApi = {
  createPayment: (
    data: FormData,
    participant_id?: number,
    auto_verify?: boolean
  ) => {
    if (participant_id !== undefined) {
      data.append("participant_id", participant_id.toString());
    }
    if (auto_verify !== undefined) {
      data.append("auto_verify", auto_verify.toString());
    }
    return api.post("/payments/", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  getGroupPayments: (groupId: number, skip = 0, limit = 50) =>
    api.get(`/payments/group/${groupId}`, { params: { skip, limit } }),

  getMyPayments: (skip = 0, limit = 50) =>
    api.get("/payments/my-payments", { params: { skip, limit } }),

  getPayment: (id: number) => api.get(`/payments/${id}`),

  updatePayment: (id: number, data: FormData) =>
    api.put(`/payments/${id}`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),

  deletePayment: (id: number) => api.delete(`/payments/${id}`),

  verifyPayment: (id: number) => api.post(`/payments/${id}/verify`),

  getGroupPaymentStats: (groupId: number) =>
    api.get(`/payments/group/${groupId}/stats`),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get("/dashboard/stats"),

  getActivity: (limit = 20) =>
    api.get("/dashboard/recent-activity", { params: { limit } }),

  getPaymentSummary: () => api.get("/dashboard/payment-summary"),

  getGroupSummaries: () => api.get("/dashboard/group-summaries"),

  getNotifications: () => api.get("/dashboard/notifications"),

  getOverdueParticipants: () => api.get("/dashboard/overdue-participants"),

  getGroupDetail: (id: number) => api.get(`/dashboard/groups/${id}`),

  // New endpoints
  getNextPayers: (opts?: { limit?: number; groupId?: number }) =>
    api.get("/dashboard/next-payers", {
      params: { limit: opts?.limit, group_id: opts?.groupId },
    }),

  getLastPayers: (opts?: { limit?: number; groupId?: number }) =>
    api.get("/dashboard/last-payers", {
      params: { limit: opts?.limit, group_id: opts?.groupId },
    }),

  getGroupSpecificStats: (groupId: string, periodDate?: string) =>
    api.get(`/dashboard/groups/${groupId}/stats`, {
      params: periodDate ? { period_date: periodDate } : {}
    }),

  reassignPayer: (groupId: number, skipParticipantId: number) =>
    api.post(`/dashboard/reassign-payer/${groupId}`, null, {
      params: { skip_participant_id: skipParticipantId },
    }),
};

// Public API (sin autenticación)
export const publicApi = {
  getOverdueParticipants: (groupId: number) => {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    if (apiUrl.endsWith("/api")) {
      apiUrl = apiUrl.replace("/api", "");
    }
    return fetch(`${apiUrl}/public/overdue/${groupId}`).then((res) =>
      res.json()
    );
  },
};

// Utility functions
export const handleApiError = (error: AxiosError): string => {
  if (error.response?.data && typeof error.response.data === "object") {
    const data = error.response.data as { detail?: string; message?: string };
    return data.detail || data.message || "Error desconocido";
  }
  return error.message || "Error de conexión";
};

export const setAuthToken = (token: string) => {
  Cookies.set("access_token", token, { expires: 7 }); // 7 days
};

export const removeAuthToken = () => {
  Cookies.remove("access_token");
};

export const getAuthToken = (): string | undefined => {
  return Cookies.get("access_token");
};

export default api;
