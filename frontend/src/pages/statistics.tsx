import { Layout } from "@/components/layout";
import { Badge, Button, Card, Loading, useToast } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { groupsApi, paymentsApi } from "@/lib/api";
import type { Group, PaymentStats } from "@/types";
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

interface GroupStats extends Group {
  stats?: PaymentStats;
  lastPaymentDate?: string;
  memberStats?: {
    user_name: string;
    user_id: number;
    total_amount: number;
    payment_count: number;
    last_payment?: string;
    days_since_last: number;
    is_up_to_date: boolean;
  }[];
}

const StatisticsPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupStats[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await groupsApi.getGroups();
      setGroups(response.data);
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar los grupos",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupStats = async (group: Group) => {
    setStatsLoading(true);
    try {
      const [statsResponse, paymentsResponse] = await Promise.all([
        paymentsApi.getGroupPaymentStats(group.id),
        paymentsApi.getGroupPayments(group.id, 0, 100),
      ]);

      // Calcular estadísticas por miembro
      const memberStats = statsResponse.data.user_payments.map((userPayment: any) => {
        const userPayments = paymentsResponse.data.filter(
          (payment: any) => payment.user_id === userPayment.user_id
        );
        const lastPayment = userPayments.length > 0 
          ? userPayments.sort((a: any, b: any) => 
              new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
            )[0]
          : null;
        
        const daysSinceLast = lastPayment 
          ? Math.floor((Date.now() - new Date(lastPayment.payment_date).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        // Determinar si está al día basado en la frecuencia de pago
        const frequencyDays = {
          weekly: 7,
          monthly: 30,
          quarterly: 90,
          yearly: 365,
        }[group.payment_frequency] || 30;
        
        return {
          ...userPayment,
          last_payment: lastPayment?.payment_date,
          days_since_last: daysSinceLast,
          is_up_to_date: daysSinceLast <= frequencyDays,
        };
      });

      const groupWithStats: GroupStats = {
        ...group,
        stats: statsResponse.data,
        memberStats,
        lastPaymentDate: paymentsResponse.data[0]?.payment_date,
      };

      setSelectedGroup(groupWithStats);
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar las estadísticas del grupo",
      });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleGroupSelect = (group: Group) => {
    fetchGroupStats(group);
  };

  const getPaymentStatusColor = (isUpToDate: boolean, daysSinceLast: number) => {
    if (isUpToDate) return "text-green-600";
    if (daysSinceLast > 60) return "text-red-600";
    return "text-yellow-600";
  };

  const getPaymentStatusIcon = (isUpToDate: boolean, daysSinceLast: number) => {
    if (isUpToDate) return CheckCircleIcon;
    if (daysSinceLast > 60) return XCircleIcon;
    return ClockIcon;
  };

  if (loading) {
    return (
      <Layout>
        <Loading size="lg" text="Cargando estadísticas..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-gray-600">
            Analiza el rendimiento de pagos por grupo
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Groups List */}
          <div className="lg:col-span-1">
            <Card>
              <Card.Header>
                <h3 className="text-lg font-medium text-gray-900">
                  Seleccionar Grupo
                </h3>
              </Card.Header>
              <Card.Body>
                {groups.length > 0 ? (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleGroupSelect(group)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedGroup?.id === group.id
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {group.name}
                            </h4>
                            <p className="text-sm text-gray-500">
                              ${group.payment_amount} /{" "}
                              {group.payment_frequency === "weekly"
                                ? "semana"
                                : group.payment_frequency === "monthly"
                                ? "mes"
                                : group.payment_frequency === "quarterly"
                                ? "trimestre"
                                : "año"}
                            </p>
                          </div>
                          <ChartBarIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No hay grupos
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Crea un grupo para ver estadísticas.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => router.push("/groups")}
                    >
                      Ir a Grupos
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>

          {/* Group Statistics */}
          <div className="lg:col-span-2">
            {selectedGroup ? (
              <div className="space-y-6">
                {statsLoading ? (
                  <Loading size="md" text="Cargando estadísticas del grupo..." />
                ) : (
                  <>
                    {/* Group Overview */}
                    <Card>
                      <Card.Header>
                        <h3 className="text-lg font-medium text-gray-900">
                          {selectedGroup.name} - Resumen
                        </h3>
                      </Card.Header>
                      <Card.Body>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-2">
                              <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <p className="text-2xl font-semibold text-gray-900">
                              ${selectedGroup.stats?.total_payments || 0}
                            </p>
                            <p className="text-sm text-gray-500">Total Recaudado</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-2">
                              <CheckCircleIcon className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="text-2xl font-semibold text-gray-900">
                              {selectedGroup.stats?.payment_count || 0}
                            </p>
                            <p className="text-sm text-gray-500">Total Pagos</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-2">
                              <CheckCircleIcon className="w-6 h-6 text-purple-600" />
                            </div>
                            <p className="text-2xl font-semibold text-gray-900">
                              {selectedGroup.stats?.verified_payments || 0}
                            </p>
                            <p className="text-sm text-gray-500">Verificados</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-2">
                              <ClockIcon className="w-6 h-6 text-yellow-600" />
                            </div>
                            <p className="text-2xl font-semibold text-gray-900">
                              {(selectedGroup.stats?.payment_count || 0) - (selectedGroup.stats?.verified_payments || 0)}
                            </p>
                            <p className="text-sm text-gray-500">Pendientes</p>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>

                    {/* Member Statistics */}
                    <Card>
                      <Card.Header>
                        <h3 className="text-lg font-medium text-gray-900">
                          Estadísticas por Miembro
                        </h3>
                      </Card.Header>
                      <Card.Body>
                        {selectedGroup.memberStats && selectedGroup.memberStats.length > 0 ? (
                          <div className="space-y-4">
                            {selectedGroup.memberStats.map((member, index) => {
                              const StatusIcon = getPaymentStatusIcon(
                                member.is_up_to_date,
                                member.days_since_last
                              );
                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                                >
                                  <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                        <span className="text-sm font-medium text-primary-600">
                                          {member.user_name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900">
                                        {member.user_name}
                                      </h4>
                                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                                        <span>
                                          ${member.total_amount.toFixed(2)} pagado
                                        </span>
                                        <span>
                                          {member.payment_count} pagos
                                        </span>
                                        {member.last_payment && (
                                          <span>
                                            Último:{" "}
                                            {format(
                                              new Date(member.last_payment),
                                              "dd/MM/yyyy",
                                              { locale: es }
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className={`flex items-center space-x-1 ${
                                        getPaymentStatusColor(
                                          member.is_up_to_date,
                                          member.days_since_last
                                        )
                                      }`}
                                    >
                                      <StatusIcon className="w-4 h-4" />
                                      <span className="text-sm font-medium">
                                        {member.is_up_to_date
                                          ? "Al día"
                                          : member.days_since_last > 60
                                          ? "Atrasado"
                                          : "Por vencer"}
                                      </span>
                                    </div>
                                    {member.days_since_last < 999 && (
                                      <Badge
                                        variant={
                                          member.is_up_to_date
                                            ? "success"
                                            : member.days_since_last > 60
                                            ? "danger"
                                            : "warning"
                                        }
                                        size="sm"
                                      >
                                        {member.days_since_last} días
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                              No hay datos de pagos
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Los miembros aún no han realizado pagos en este grupo.
                            </p>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </>
                )}
              </div>
            ) : (
              <Card>
                <Card.Body>
                  <div className="text-center py-12">
                    <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      Selecciona un grupo
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Elige un grupo de la lista para ver sus estadísticas detalladas.
                    </p>
                  </div>
                </Card.Body>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default StatisticsPage;