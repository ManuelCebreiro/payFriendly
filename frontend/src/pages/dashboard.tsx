import { Layout } from "@/components/layout";
import {
  Badge,
  Button,
  Card,
  Input,
  Loading,
  Modal,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardApi, groupsApi, paymentsApi } from "@/lib/api";
import type {
  ActivityItem,
  DashboardStats,
  GroupSummary,
  LastPayerItem,
  NextPayer,
  Notification,
  OverdueParticipant,
  ReassignPayerResponse,
} from "@/types";
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  PlusIcon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const { groupId } = router.query;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [overdueParticipants, setOverdueParticipants] = useState<
    OverdueParticipant[]
  >([]);
  const [lastModifiedGroup, setLastModifiedGroup] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupStats, setGroupStats] = useState<any>(null);
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Keep for backward compatibility
  const [loading, setLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [nextPayers, setNextPayers] = useState<NextPayer[]>([]);
  const [lastPayers, setLastPayers] = useState<LastPayerItem[]>([]);
  const [showMoreNextPayers, setShowMoreNextPayers] = useState(false);

  // Modal states
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  // Form states
  const [memberForm, setMemberForm] = useState({
    guest_name: "",
    guest_email: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    description: "",
    payers: [{ participant_id: "", amount: "" }],
  });
  const [receiptFiles, setReceiptFiles] = useState<(File | null)[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fetchDashboardData = async () => {
    try {
      const monthStart = format(startOfMonth(currentPeriod), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentPeriod), "yyyy-MM-dd");

      const [
        statsData,
        activityData,
        summariesData,
        notificationsData,
        overdueData,
        nextPayersData,
        lastPayersData,
      ] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getActivity(),
        dashboardApi.getPaymentSummary(),
        dashboardApi.getNotifications(),
        dashboardApi.getOverdueParticipants(),
        dashboardApi.getNextPayers({ limit: 20 }),
        dashboardApi.getLastPayers({ limit: 10 }),
      ]);

      setStats(statsData.data);
      setActivity(activityData.data.activity || []);
      setGroupSummaries(summariesData.data.group_summaries || []);
      setNotifications(notificationsData.data);
      setOverdueParticipants(overdueData.data);
      setNextPayers(nextPayersData.data.next_payers || []);
      setLastPayers(lastPayersData.data.last_payers || []);
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar los datos del dashboard",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupSpecificData = async (groupIdParam: string) => {
    try {
      // Obtener datos del grupo específico
      const groupResponse = await groupsApi.getGroup(parseInt(groupIdParam));
      const group = groupResponse.data;
      setSelectedGroup(group);

      // Obtener estadísticas específicas del grupo con períodos
      const periodDateParam = currentPeriod.toISOString();
      const statsResponse = await dashboardApi.getGroupSpecificStats(
        groupIdParam,
        periodDateParam
      );
      const groupStats = statsResponse.data;

      // Calcular días restantes del período actual
      const now = new Date();
      const periodEnd = new Date(groupStats.current_period.end);
      const daysLeft = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      setDaysRemaining(Math.max(0, daysLeft));

      setGroupStats({
        totalPaid: groupStats.current_period.collected_amount,
        totalPending: groupStats.current_period.pending_amount,
        verifiedPayments: groupStats.current_period.payments.filter(
          (p: any) => p.is_verified
        ),
        pendingPayments: groupStats.current_period.payments.filter(
          (p: any) => !p.is_verified
        ),
        periodStart: new Date(groupStats.current_period.start),
        periodEnd: new Date(groupStats.current_period.end),
        frequency: groupStats.payment_frequency,
        currentPeriodPayments: groupStats.current_period.payments,
        previousPeriodPayments: groupStats.previous_period.payments,
      });
      // Fetch group-specific next and last payers
      const [nextPayersResp, lastPayersResp] = await Promise.all([
        dashboardApi.getNextPayers({ limit: 20, groupId: group.id }),
        dashboardApi.getLastPayers({ limit: 10, groupId: group.id }),
      ]);
      setNextPayers(nextPayersResp.data.next_payers || []);
      setLastPayers(lastPayersResp.data.last_payers || []);
    } catch (error) {
      console.error("Error fetching group specific data:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar los datos del grupo",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLastModifiedGroup = async () => {
    try {
      const groupsResponse = await groupsApi.getGroups();
      if (groupsResponse.data.length > 0) {
        // Obtener el grupo más recientemente modificado
        const sortedGroups = groupsResponse.data.sort(
          (a: any, b: any) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        );
        const recentGroup = sortedGroups[0];

        // Obtener estadísticas del grupo usando el endpoint del dashboard
        const groupStatsResponse = await dashboardApi.getGroupSpecificStats(
          recentGroup.id
        );
        const groupStats = groupStatsResponse.data;

        // Filtrar pagos pendientes para mostrar
        const pendingPayments = groupStats.current_period.payments.filter(
          (payment: any) => !payment.is_verified
        );

        // El totalPending ya viene calculado correctamente del backend
        const totalPending = groupStats.current_period.pending_amount;

        setLastModifiedGroup({
          ...recentGroup,
          pendingPayments: pendingPayments.slice(0, 3), // Solo mostrar los primeros 3
          totalPending: totalPending,
        });
      }
    } catch (error) {
      console.error("Error fetching last modified group:", error);
    }
  };

  const fetchParticipants = async (groupIdParam: string) => {
    try {
      const response = await groupsApi.getParticipants(parseInt(groupIdParam));
      setParticipants(response.data);
    } catch (error) {
      console.error("Error fetching participants:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar los participantes",
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !memberForm.guest_name.trim()) {
      addToast({
        type: "error",
        title: "Error",
        message: "El nombre es obligatorio",
      });
      return;
    }

    try {
      await groupsApi.addGuestParticipant(selectedGroup.id, {
        guest_name: memberForm.guest_name.trim(),
        guest_email: memberForm.guest_email.trim() || undefined,
      });

      addToast({
        type: "success",
        title: "Éxito",
        message: "Miembro añadido correctamente",
      });

      setMemberForm({ guest_name: "", guest_email: "" });
      setShowAddMemberModal(false);

      // Recargar participantes
      if (groupId && typeof groupId === "string") {
        fetchParticipants(groupId);
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo añadir el miembro",
      });
    }
  };

  const handleAddPayment = async () => {
    if (
      !selectedGroup ||
      paymentForm.payers.some((p) => !p.participant_id || !p.amount)
    ) {
      addToast({
        type: "error",
        title: "Error",
        message: "Todos los campos son obligatorios",
      });
      return;
    }

    try {
      // Crear un FormData para cada pago
      for (let i = 0; i < paymentForm.payers.length; i++) {
        const payer = paymentForm.payers[i];
        if (payer.participant_id && payer.amount) {
          const formData = new FormData();
          formData.append("group_id", selectedGroup.id.toString());
          formData.append("amount", payer.amount);
          formData.append(
            "notes",
            paymentForm.description || "Pago añadido desde dashboard"
          );

          // Añadir archivo de comprobante si existe
          if (receiptFiles[i]) {
            formData.append("receipt", receiptFiles[i]!);
          }

          await paymentsApi.createPayment(
            formData,
            parseInt(payer.participant_id),
            true
          );
        }
      }

      addToast({
        type: "success",
        title: "Éxito",
        message: "Pago(s) añadido(s) correctamente",
      });

      setPaymentForm({
        description: "",
        payers: [{ participant_id: "", amount: "" }],
      });
      setReceiptFiles([null]);
      setShowAddPaymentModal(false);

      // Recargar datos del grupo y próximos pagadores del siguiente período
      if (groupId && typeof groupId === "string") {
        await fetchGroupSpecificData(groupId);
        // También recargar próximos pagadores del siguiente período y últimos pagadores
        try {
          const [nextPayersData, lastPayersData] = await Promise.all([
            dashboardApi.getNextPayers({
              limit: 20,
              groupId: parseInt(groupId),
            }),
            dashboardApi.getLastPayers({
              limit: 10,
              groupId: parseInt(groupId),
            }),
          ]);
          setNextPayers(nextPayersData.data || []);
          setLastPayers(lastPayersData.data || []);
        } catch (error) {
          console.error("Error recargando pagadores:", error);
        }
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo añadir el pago",
      });
    }
  };

  const addPayer = () => {
    setPaymentForm((prev) => ({
      ...prev,
      payers: [...prev.payers, { participant_id: "", amount: "" }],
    }));
    setReceiptFiles((prev) => [...prev, null]);
  };

  const removePayer = (index: number) => {
    setPaymentForm((prev) => ({
      ...prev,
      payers: prev.payers.filter((_, i) => i !== index),
    }));
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePayer = (index: number, field: string, value: string) => {
    setPaymentForm((prev) => ({
      ...prev,
      payers: prev.payers.map((payer, i) =>
        i === index ? { ...payer, [field]: value } : payer
      ),
    }));
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este pago?")) {
      return;
    }

    try {
      await paymentsApi.deletePayment(paymentId);

      addToast({
        type: "success",
        title: "Éxito",
        message: "Pago eliminado correctamente",
      });

      // Recargar datos del grupo
      if (groupId && typeof groupId === "string") {
        fetchGroupSpecificData(groupId);
      } else {
        fetchDashboardData();
        fetchLastModifiedGroup();
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo eliminar el pago",
      });
    }
  };

  const handleReassignPayer = async (
    participantId: number,
    participantName: string
  ) => {
    if (!selectedGroup) return;

    if (
      !confirm(`¿Saltar a ${participantName} y asignar al siguiente aportador?`)
    ) {
      return;
    }

    try {
      const response = await dashboardApi.reassignPayer(
        selectedGroup.id,
        participantId
      );
      const data: ReassignPayerResponse = response.data;

      addToast({
        type: "success",
        title: "Aportador reasignado",
        message: data.next_participant
          ? `${data.skipped_participant.name} saltado. Siguiente: ${data.next_participant.name}`
          : `${data.skipped_participant.name} saltado exitosamente`,
      });

      // Actualizar la lista de próximos aportadores
      setNextPayers(data.updated_ranking);

      // Solo recargar estadísticas del grupo sin sobrescribir nextPayers
      if (groupId && typeof groupId === "string") {
        // Recargar solo las estadísticas sin afectar nextPayers
        const groupResponse = await groupsApi.getGroup(parseInt(groupId));
        const group = groupResponse.data;
        setSelectedGroup(group);

        const periodDateParam = currentPeriod.toISOString();
        const statsResponse = await dashboardApi.getGroupSpecificStats(
          groupId,
          periodDateParam
        );
        const groupStats = statsResponse.data;

        const now = new Date();
        const periodEnd = new Date(groupStats.current_period.end);
        const daysLeft = Math.ceil(
          (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        setDaysRemaining(Math.max(0, daysLeft));

        setGroupStats({
          totalPaid: groupStats.current_period.collected_amount,
          totalPending: groupStats.current_period.pending_amount,
          verifiedPayments: groupStats.current_period.payments.filter(
            (p: any) => p.is_verified
          ),
          pendingPayments: groupStats.current_period.payments.filter(
            (p: any) => !p.is_verified
          ),
          periodStart: new Date(groupStats.current_period.start),
          periodEnd: new Date(groupStats.current_period.end),
          frequency: groupStats.payment_frequency,
          currentPeriodPayments: groupStats.current_period.payments,
          previousPeriodPayments: groupStats.previous_period.payments,
        });

        // Solo actualizar lastPayers, no nextPayers
        const lastPayersResp = await dashboardApi.getLastPayers({
          limit: 10,
          groupId: group.id,
        });
        setLastPayers(lastPayersResp.data.last_payers || []);
      }
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Error",
        message:
          error.response?.data?.detail || "No se pudo reasignar el aportador",
      });
    }
  };

  useEffect(() => {
    if (groupId && typeof groupId === "string") {
      // Modo grupo específico
      fetchGroupSpecificData(groupId);
      fetchParticipants(groupId);
    } else {
      // Redirigir a lista de grupos si no hay grupo seleccionado
      router.replace("/groups");
    }
  }, [currentPeriod, addToast, groupId]);

  const navigatePeriod = (direction: "prev" | "next") => {
    if (!selectedGroup) return;

    const frequency = selectedGroup.payment_frequency;
    let newPeriod = new Date(currentPeriod);

    if (direction === "prev") {
      if (frequency === "weekly") {
        newPeriod.setDate(newPeriod.getDate() - 7);
      } else if (frequency === "monthly") {
        newPeriod = subMonths(newPeriod, 1);
      } else if (frequency === "quarterly") {
        newPeriod = subMonths(newPeriod, 3);
      } else if (frequency === "yearly") {
        newPeriod.setFullYear(newPeriod.getFullYear() - 1);
      }
    } else {
      if (frequency === "weekly") {
        newPeriod.setDate(newPeriod.getDate() + 7);
      } else if (frequency === "monthly") {
        newPeriod = addMonths(newPeriod, 1);
      } else if (frequency === "quarterly") {
        newPeriod = addMonths(newPeriod, 3);
      } else if (frequency === "yearly") {
        newPeriod.setFullYear(newPeriod.getFullYear() + 1);
      }
    }

    setCurrentPeriod(newPeriod);
    setCurrentMonth(newPeriod); // Keep for backward compatibility
  };

  const navigateMonth = (direction: "prev" | "next") => {
    // Use the new period-based navigation
    navigatePeriod(direction);
  };

  const getPeriodLabel = () => {
    if (!selectedGroup)
      return format(currentPeriod, "MMMM yyyy", { locale: es });

    const frequency = selectedGroup.payment_frequency;
    if (frequency === "weekly") {
      const startOfWeek = new Date(currentPeriod);
      startOfWeek.setDate(currentPeriod.getDate() - currentPeriod.getDay() + 1); // Monday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      return `${format(startOfWeek, "dd MMM", { locale: es })} - ${format(
        endOfWeek,
        "dd MMM yyyy",
        { locale: es }
      )}`;
    } else if (frequency === "monthly") {
      return format(currentPeriod, "MMMM yyyy", { locale: es });
    } else if (frequency === "quarterly") {
      const quarter = Math.floor(currentPeriod.getMonth() / 3) + 1;
      return `Q${quarter} ${currentPeriod.getFullYear()}`;
    } else if (frequency === "yearly") {
      return currentPeriod.getFullYear().toString();
    }
    return format(currentPeriod, "MMMM yyyy", { locale: es });
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    if (!selectedGroup) {
      // For general dashboard, check if it's current month
      return (
        currentPeriod.getMonth() === now.getMonth() &&
        currentPeriod.getFullYear() === now.getFullYear()
      );
    }

    const frequency = selectedGroup.payment_frequency;
    if (frequency === "weekly") {
      // Check if current period is in the same week as today
      const startOfWeek = new Date(currentPeriod);
      startOfWeek.setDate(currentPeriod.getDate() - currentPeriod.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return now >= startOfWeek && now <= endOfWeek;
    } else if (frequency === "monthly") {
      return (
        currentPeriod.getMonth() === now.getMonth() &&
        currentPeriod.getFullYear() === now.getFullYear()
      );
    } else if (frequency === "quarterly") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const periodQuarter = Math.floor(currentPeriod.getMonth() / 3);
      return (
        currentQuarter === periodQuarter &&
        currentPeriod.getFullYear() === now.getFullYear()
      );
    } else if (frequency === "yearly") {
      return currentPeriod.getFullYear() === now.getFullYear();
    }

    return false;
  };

  // Keep for backward compatibility
  const isCurrentMonth = () => {
    return isCurrentPeriod();
  };

  if (loading) {
    return (
      <Layout>
        <Loading size="lg" text="Cargando dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            {selectedGroup && (
              <div className="mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/groups")}
                  className="flex items-center"
                >
                  ← Volver al Dashboard General
                </Button>
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedGroup
                ? `Dashboard - ${selectedGroup.name}`
                : `Bienvenido, ${user?.full_name}`}
            </h1>
            <p className="text-gray-600">
              {selectedGroup
                ? `Estadísticas del período actual (${
                    groupStats?.frequency === "weekly"
                      ? "semanal"
                      : groupStats?.frequency === "monthly"
                      ? "mensual"
                      : groupStats?.frequency === "quarterly"
                      ? "trimestral"
                      : "anual"
                  })`
                : "Aquí tienes un resumen de tu actividad reciente"}
            </p>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="flex items-center"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </Button>

            <div className="text-center">
              <h2
                className={`text-lg font-semibold ${
                  isCurrentPeriod() ? "text-primary-600" : "text-gray-900"
                }`}
              >
                {getPeriodLabel()}
              </h2>
              {isCurrentPeriod() && (
                <span className="text-xs text-primary-600 font-medium">
                  {selectedGroup
                    ? selectedGroup.payment_frequency === "weekly"
                      ? "Semana actual"
                      : selectedGroup.payment_frequency === "monthly"
                      ? "Mes actual"
                      : selectedGroup.payment_frequency === "quarterly"
                      ? "Trimestre actual"
                      : "Año actual"
                    : "Mes actual"}
                </span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="flex items-center"
              disabled={isCurrentPeriod()}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {(stats || groupStats) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Grupo Actual / Grupos */}
            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {selectedGroup ? "Grupo Actual" : "Grupos"}
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedGroup ? selectedGroup.name : stats?.total_groups}
                  </p>
                  {selectedGroup && (
                    <p className="text-xs text-gray-500 capitalize">
                      Frecuencia:{" "}
                      {selectedGroup.payment_frequency === "weekly"
                        ? "Semanal"
                        : selectedGroup.payment_frequency === "monthly"
                        ? "Mensual"
                        : selectedGroup.payment_frequency === "quarterly"
                        ? "Trimestral"
                        : "Anual"}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => router.push("/payments")}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CreditCardIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {selectedGroup ? "Pagos Realizados" : "Pagos Totales"}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {selectedGroup
                      ? `€${groupStats?.totalPaid?.toFixed(2) || "0.00"}`
                      : stats?.total_payments}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {selectedGroup ? "Pagos Pendientes" : "Pendientes"}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {selectedGroup
                      ? `€${groupStats?.totalPending?.toFixed(2) || "0.00"}`
                      : stats?.pending_payments}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {selectedGroup ? "Días Restantes" : "Grupo Actual"}
                  </p>
                  {selectedGroup ? (
                    <>
                      <p className="text-2xl font-semibold text-gray-900">
                        {daysRemaining}
                      </p>
                      <p className="text-xs text-gray-500">
                        {daysRemaining === 1 ? "día" : "días"} para el próximo
                        período
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-gray-900">
                        {lastModifiedGroup?.name || "N/A"}
                      </p>
                      {lastModifiedGroup?.totalPending > 0 && (
                        <p className="text-sm text-red-600">
                          {lastModifiedGroup.totalPending} pendientes
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Action Buttons for Group */}
        {selectedGroup && (
          <div className="flex justify-center flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowAddMemberModal(true)}
              className="flex items-center"
            >
              <UserPlusIcon className="w-5 h-5 mr-2" />
              Añadir Miembro
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/groups/${selectedGroup.id}/members`)}
              className="flex items-center"
            >
              Ver Miembros
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowAddPaymentModal(true)}
              className="flex items-center"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Añadir Pago
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() =>
                router.push(`/groups/${selectedGroup.id}/payments`)
              }
              className="flex items-center"
            >
              Ver Pagos
            </Button>
          </div>
        )}

        {/* Próximos pagadores del siguiente período - Arriba del todo */}
        {selectedGroup && (
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Próximos pagadores del siguiente período
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/public/overdue/${selectedGroup.id}`;
                    navigator.clipboard.writeText(url);
                    addToast({
                      type: "success",
                      title: "Enlace copiado",
                      message:
                        "Puedes compartir este enlace para mostrar quién debe pagar",
                    });
                  }}
                >
                  Compartir lista
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {nextPayers.length > 0 ? (
                <div className="relative">
                  <div
                    className={`space-y-3 ${
                      showMoreNextPayers && nextPayers.length > 4
                        ? "max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                        : ""
                    }`}
                  >
                    {nextPayers
                      .slice(0, showMoreNextPayers ? nextPayers.length : 2)
                      .map((p, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-200"
                        >
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <span className="text-red-600 font-semibold text-sm">
                                {index + 1}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">
                              {p.name}
                            </p>
                            <p className="text-sm text-red-700">
                              {p.days_since_last} días desde último pago
                            </p>
                            {p.last_payment_date && (
                              <p className="text-xs text-red-600">
                                Último pago:{" "}
                                {format(
                                  new Date(p.last_payment_date),
                                  "dd/MM/yyyy",
                                  { locale: es }
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            <Badge variant="danger" size="sm">
                              {p.days_since_last}d
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleReassignPayer(p.participant_id, p.name)
                              }
                              className="text-xs px-2 py-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                            >
                              Saltar
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                  {nextPayers.length > 2 && (
                    <div className="flex items-center justify-center mt-3 pt-2 border-t border-gray-200">
                      <button
                        onClick={() =>
                          setShowMoreNextPayers(!showMoreNextPayers)
                        }
                        className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {!showMoreNextPayers ? (
                          <>
                            <span>
                              Ver {Math.min(nextPayers.length - 2, 2)} más
                              participantes
                            </span>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>Ver menos</span>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {showMoreNextPayers && nextPayers.length > 4 && (
                    <div className="flex items-center justify-center mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>
                          +{nextPayers.length - 4} más participantes (scroll
                          para ver)
                        </span>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircleIcon className="mx-auto h-8 w-8 text-green-400 mb-2" />
                  <p className="text-gray-500">
                    Todos los pagos están al día para el siguiente período
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Pagos del Período Actual y Últimos Pagadores - Mismo espacio que Próximos Pagadores del Siguiente Período */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pagos del Período Actual */}
          {selectedGroup && groupStats ? (
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedGroup.name} - Pagos del Período Actual
                  </h3>
                  <Badge variant="info" size="sm">
                    {groupStats.frequency === "weekly"
                      ? "Semanal"
                      : groupStats.frequency === "monthly"
                      ? "Mensual"
                      : groupStats.frequency === "quarterly"
                      ? "Trimestral"
                      : "Anual"}
                  </Badge>
                </div>
              </Card.Header>
              <Card.Body>
                {/* Mostrar TODOS los pagos del período actual (pendientes + pagados) */}
                {groupStats.currentPeriodPayments &&
                groupStats.currentPeriodPayments.length > 0 ? (
                  <div className="space-y-3">
                    {groupStats.currentPeriodPayments
                      .slice(0, 5)
                      .map((payment: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg border border-green-200"
                        >
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                              <ClockIcon className="h-4 w-4 text-green-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {payment.user_name} - €{payment.amount}
                            </p>
                            <p className="text-sm text-gray-500">
                              {format(
                                new Date(payment.payment_date),
                                "dd/MM/yyyy",
                                {
                                  locale: es,
                                }
                              )}
                              {payment.notes && ` • ${payment.notes}`}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center space-x-2">
                            <div className="relative group">
                              <Badge
                                variant={
                                  payment.receipt_url ? "success" : "warning"
                                }
                                size="sm"
                                className="cursor-help"
                              >
                                {payment.receipt_url ? "Verificado" : "Pagado"}
                              </Badge>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                {payment.receipt_url
                                  ? "Pagado y factura adjunta"
                                  : "Está pagado pero no tiene justificante"}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                            {payment.user_id === user?.id && (
                              <>
                                <button
                                  onClick={() =>
                                    handleDeletePayment(payment.id)
                                  }
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                                  title="Eliminar pago"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    const newAmountStr = window.prompt(
                                      "Nuevo importe",
                                      String(payment.amount)
                                    );
                                    if (newAmountStr === null) return;
                                    const newAmount = parseFloat(newAmountStr);
                                    if (isNaN(newAmount)) return;
                                    const form = new FormData();
                                    form.append("amount", String(newAmount));
                                    try {
                                      await paymentsApi.updatePayment(
                                        payment.id,
                                        form
                                      );
                                      if (
                                        groupId &&
                                        typeof groupId === "string"
                                      ) {
                                        fetchGroupSpecificData(groupId);
                                      } else {
                                        fetchDashboardData();
                                      }
                                      addToast({
                                        type: "success",
                                        title: "Pago actualizado",
                                      });
                                    } catch (e) {
                                      addToast({
                                        type: "error",
                                        title: "Error al actualizar",
                                      });
                                    }
                                  }}
                                  className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                                  title="Editar pago"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5h2m2 0h2m-6 4h8m-8 4h8m-8 4h8M5 7h2m-2 4h2m-2 4h2"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    {groupStats.currentPeriodPayments.length > 5 && (
                      <div className="text-center pt-2">
                        <p className="text-sm text-gray-500">
                          +{groupStats.currentPeriodPayments.length - 5} más
                          pagos
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <ClockIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-900">
                      Sin pagos este período
                    </p>
                    <p className="text-xs text-gray-500">
                      No hay pagos registrados en este período.
                    </p>
                  </div>
                )}
              </Card.Body>
            </Card>
          ) : (
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {lastModifiedGroup
                      ? `${lastModifiedGroup.name} - Pagos Pendientes`
                      : "Actividad Reciente"}
                  </h3>
                  {lastModifiedGroup && (
                    <Badge variant="info" size="sm">
                      Último modificado
                    </Badge>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                {lastModifiedGroup &&
                lastModifiedGroup.pendingPayments?.length > 0 ? (
                  <div className="space-y-4">
                    {lastModifiedGroup.pendingPayments?.map(
                      (payment: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg border border-green-200"
                        >
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                              <ClockIcon className="h-4 w-4 text-green-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {payment.user_name} - €{payment.amount}
                            </p>
                            <p className="text-sm text-gray-500">
                              {format(
                                new Date(payment.payment_date),
                                "dd/MM/yyyy",
                                {
                                  locale: es,
                                }
                              )}
                              {payment.notes && ` • ${payment.notes}`}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center space-x-2">
                            <Badge variant="warning" size="sm">
                              Pendiente
                            </Badge>
                            {payment.user_id === user?.id && (
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                                title="Eliminar pago"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    )}
                    {(lastModifiedGroup.totalPending || 0) > 3 && (
                      <div className="text-center pt-2">
                        <p className="text-sm text-gray-500">
                          Y {lastModifiedGroup.totalPending - 3} pagos
                          pendientes más...
                        </p>
                      </div>
                    )}
                  </div>
                ) : lastModifiedGroup ? (
                  <div className="text-center py-8">
                    <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      ¡Todos los pagos están al día!
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No hay pagos pendientes en este grupo.
                    </p>
                  </div>
                ) : activity.length > 0 ? (
                  <div className="space-y-4">
                    {activity.map((item, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <CreditCardIcon className="w-4 h-4 text-primary-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {item.user_name} pagó ${item.amount} en{" "}
                            {item.group_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(item.date), "PPp", {
                              locale: es,
                            })}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge
                            variant={
                              item.type === "payment" ? "success" : "info"
                            }
                            size="sm"
                          >
                            ${item.amount?.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No hay actividad reciente
                  </p>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Últimos Pagadores */}
          <Card>
            <Card.Header>
              <h3 className="text-lg font-medium text-gray-900">
                Últimos Pagadores
              </h3>
            </Card.Header>
            <Card.Body>
              {lastPayers.length > 0 ? (
                <div className="space-y-3">
                  {lastPayers.slice(0, 3).map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(p.payment_date), "dd/MM/yyyy", {
                            locale: es,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <Badge variant="success" size="sm">
                          Pagado
                        </Badge>
                        <Badge variant="info" size="sm">
                          €{p.amount}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {lastPayers.length > 3 && (
                    <div className="text-center pt-2">
                      <p className="text-sm text-gray-500">
                        +{lastPayers.length - 3} más pagos
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <ClockIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Sin pagos recientes
                  </p>
                  <p className="text-xs text-gray-500">
                    No hay pagos en el período anterior.
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        {/* Group Summaries */}
        {groupSummaries.length > 0 && (
          <Card>
            <Card.Header>
              <h3 className="text-lg font-medium text-gray-900">
                Resumen de Grupos
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupSummaries.map((summary) => (
                  <div
                    key={summary.group_id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/groups/${summary.group_id}`)}
                  >
                    <h4 className="font-medium text-gray-900 mb-2">
                      {summary.group_name}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total pagado:</span>
                        <span className="font-medium">
                          ${summary.total_paid}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Cantidad de pagos:
                        </span>
                        <span className="font-medium">
                          {summary.payment_count}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estado:</span>
                        <span
                          className={`font-medium ${
                            summary.is_due ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {summary.is_due ? "Vencido" : "Al día"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Modal para añadir miembro */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setMemberForm({ guest_name: "", guest_email: "" });
        }}
        title="Añadir Miembro al Grupo"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <Input
              type="text"
              value={memberForm.guest_name}
              onChange={(e) =>
                setMemberForm((prev) => ({
                  ...prev,
                  guest_name: e.target.value,
                }))
              }
              placeholder="Nombre del miembro"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (opcional)
            </label>
            <Input
              type="email"
              value={memberForm.guest_email}
              onChange={(e) =>
                setMemberForm((prev) => ({
                  ...prev,
                  guest_email: e.target.value,
                }))
              }
              placeholder="email@ejemplo.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si el usuario se registra más tarde, podrá unirse mediante
              invitación
            </p>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddMemberModal(false);
                setMemberForm({ guest_name: "", guest_email: "" });
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAddMember}
              disabled={!memberForm.guest_name.trim()}
            >
              Añadir Miembro
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para añadir pago */}
      <Modal
        isOpen={showAddPaymentModal}
        onClose={() => {
          setShowAddPaymentModal(false);
          setPaymentForm({
            description: "",
            payers: [{ participant_id: "", amount: "" }],
          });
          setReceiptFiles([null]);
        }}
        title="Añadir Pago"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <Input
              type="text"
              value={paymentForm.description}
              onChange={(e) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Descripción del pago"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Pagadores
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={addPayer}
                className="flex items-center"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Añadir Pagador
              </Button>
            </div>

            {paymentForm.payers.map((payer, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Miembro
                  </label>
                  <select
                    value={payer.participant_id}
                    onChange={(e) =>
                      updatePayer(index, "participant_id", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar miembro</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.user?.full_name || participant.guest_name}
                      </option>
                    ))}
                  </select>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Comprobante (opcional)
                    </label>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[index] = el;
                      }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setReceiptFiles((prev) => {
                          const newFiles = [...prev];
                          newFiles[index] = file;
                          return newFiles;
                        });
                      }}
                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {receiptFiles[index] && (
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-green-600">
                          ✓ {receiptFiles[index]?.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptFiles((prev) => {
                              const newFiles = [...prev];
                              newFiles[index] = null;
                              return newFiles;
                            });
                            if (fileInputRefs.current[index]) {
                              fileInputRefs.current[index]!.value = "";
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Cantidad
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payer.amount}
                    onChange={(e) =>
                      updatePayer(index, "amount", e.target.value)
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
                {paymentForm.payers.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removePayer(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddPaymentModal(false);
                setPaymentForm({
                  description: "",
                  payers: [{ participant_id: "", amount: "" }],
                });
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAddPayment}
              disabled={paymentForm.payers.some(
                (p) => !p.participant_id || !p.amount
              )}
            >
              Añadir Pago(s)
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default DashboardPage;
