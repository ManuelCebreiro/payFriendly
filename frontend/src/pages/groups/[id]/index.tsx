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
import { groupsApi, paymentsApi } from "@/lib/api";
import type {
  GroupDetail,
  GuestParticipantCreate,
  MonthlyStats,
  OverdueParticipant,
  Participant,
  User,
} from "@/types";
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  PlusIcon,
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
import React, { useEffect, useState } from "react";

const GroupDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { addToast } = useToast();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [overdueParticipants, setOverdueParticipants] = useState<
    OverdueParticipant[]
  >([]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

  // Modals
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showLinkGuestModal, setShowLinkGuestModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);

  // Forms
  const [guestForm, setGuestForm] = useState<GuestParticipantCreate>({
    guest_name: "",
    guest_email: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    participant_id: "",
    amount: "",
    notes: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (id) {
      fetchGroupDetail();
      fetchMonthlyStats();
      fetchOverdueParticipants();
      fetchRegisteredUsers();
    }
  }, [id, currentMonth]);

  const fetchGroupDetail = async () => {
    try {
      const response = await groupsApi.getGroup(parseInt(id as string));
      setGroup(response.data);
    } catch (error) {
      addToast({ title: "Error al cargar el grupo", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyStats = async () => {
    try {
      const month = format(currentMonth, "yyyy-MM");
      const response = await fetch(`/api/groups/${id}/stats?month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setMonthlyStats(data);
      }
    } catch (error) {
      console.error("Error fetching monthly stats:", error);
    }
  };

  const fetchOverdueParticipants = async () => {
    try {
      const response = await fetch(`/api/groups/${id}/overdue`);
      if (response.ok) {
        const data = await response.json();
        setOverdueParticipants(data);
      }
    } catch (error) {
      console.error("Error fetching overdue participants:", error);
    }
  };

  const fetchRegisteredUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setRegisteredUsers(
          data.filter(
            (u: User) => !group?.participants?.some((p) => p.user_id === u.id)
          )
        );
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleAddGuest = async () => {
    try {
      const response = await fetch(`/api/groups/${id}/add-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guestForm),
      });

      if (response.ok) {
        addToast({
          title: "Participante invitado añadido correctamente",
          type: "success",
        });
        setShowAddGuestModal(false);
        setGuestForm({ guest_name: "", guest_email: "" });
        fetchGroupDetail();
      } else {
        const error = await response.json();
        addToast({
          title: error.detail || "Error al añadir participante",
          type: "error",
        });
      }
    } catch (error) {
      addToast({ title: "Error al añadir participante", type: "error" });
    }
  };

  const handleLinkGuest = async (userId: number) => {
    if (!selectedParticipant) return;

    try {
      const response = await fetch(
        `/api/groups/${id}/link-guest/${selectedParticipant.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      if (response.ok) {
        addToast({
          title: "Participante vinculado correctamente",
          type: "success",
        });
        setShowLinkGuestModal(false);
        setSelectedParticipant(null);
        fetchGroupDetail();
        fetchRegisteredUsers();
      } else {
        const error = await response.json();
        addToast({
          title: error.detail || "Error al vincular participante",
          type: "error",
        });
      }
    } catch (error) {
      addToast({ title: "Error al vincular participante", type: "error" });
    }
  };

  const handleAddPayment = async () => {
    try {
      const formData = new FormData();
      formData.append("group_id", String(parseInt(id as string)));
      formData.append("amount", String(parseFloat(paymentForm.amount)));
      formData.append("notes", paymentForm.notes || "");
      if (receiptFile) {
        formData.append("receipt", receiptFile);
      }
      await paymentsApi.createPayment(
        formData,
        parseInt(paymentForm.participant_id),
        true
      );
      addToast({ title: "Pago añadido correctamente", type: "success" });
      setShowAddPaymentModal(false);
      setPaymentForm({ participant_id: "", amount: "", notes: "" });
      setReceiptFile(null);
      fetchGroupDetail();
      fetchMonthlyStats();
    } catch (error) {
      addToast({ title: "Error al añadir pago", type: "error" });
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) =>
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const getParticipantName = (participant: Participant) => {
    return (
      participant.user?.full_name || participant.guest_name || "Sin nombre"
    );
  };

  const getCurrentMonthPayments = () => {
    if (!group || !group.payments) return [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return group.payments.filter((payment) => {
      const paymentDate = new Date(payment.payment_date);
      return paymentDate >= monthStart && paymentDate <= monthEnd;
    });
  };

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">
            Grupo no encontrado
          </h2>
          <Button onClick={() => router.push("/groups")} className="mt-4">
            Volver a grupos
          </Button>
        </div>
      </Layout>
    );
  }

  const isOwner = user?.id === group.owner_id;
  const currentMonthPayments = getCurrentMonthPayments();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
            {group.description && (
              <p className="text-gray-600 mt-2">{group.description}</p>
            )}
            <div className="flex items-center space-x-4 mt-4">
              <Badge variant="info">
                €{group.payment_amount} / {group.payment_frequency}
              </Badge>
              <span className="text-sm text-gray-500">
                {group.total_participants} participantes
              </span>
            </div>
          </div>

          {isOwner && (
            <div className="flex space-x-2">
              <Button
                onClick={() => setShowAddGuestModal(true)}
                variant="outline"
                size="sm"
              >
                <UserPlusIcon className="w-4 h-4 mr-2" />
                Añadir Invitado
              </Button>
              <Button
                onClick={() => router.push(`/groups/${id}/members`)}
                variant="outline"
                size="sm"
              >
                Ver Miembros
              </Button>
              <Button onClick={() => setShowAddPaymentModal(true)} size="sm">
                <PlusIcon className="w-4 h-4 mr-2" />
                Añadir Pago
              </Button>
            </div>
          )}
        </div>

        {/* In-group navigation */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/groups/${id}`)}
          >
            Resumen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/groups/${id}/members`)}
          >
            Miembros
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/groups/${id}/payments`)}
          >
            Pagadores
          </Button>
        </div>

        {/* Month Navigation */}
        <Card>
          <Card.Header>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Dashboard - {format(currentMonth, "MMMM yyyy", { locale: es })}
              </h3>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => navigateMonth("prev")}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setCurrentMonth(new Date())}
                  variant="outline"
                  size="sm"
                >
                  Actual
                </Button>
                <Button
                  onClick={() => navigateMonth("next")}
                  variant="outline"
                  size="sm"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            {monthlyStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    €{monthlyStats.total_payments}
                  </div>
                  <div className="text-sm text-gray-500">Total Pagado</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {monthlyStats.payment_count}
                  </div>
                  <div className="text-sm text-gray-500">Pagos Realizados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    €{group.pending_amount}
                  </div>
                  <div className="text-sm text-gray-500">Pendiente</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {monthlyStats.participants_paid}/
                    {monthlyStats.total_participants}
                  </div>
                  <div className="text-sm text-gray-500">Han Pagado</div>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participants */}
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Participantes ({group.participants?.length || 0})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/groups/${id}/members`)}
                >
                  Ver miembros
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                {group.participants?.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {getParticipantName(participant).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {getParticipantName(participant)}
                        </p>
                        {participant.user ? (
                          <p className="text-sm text-green-600">Registrado</p>
                        ) : (
                          <p className="text-sm text-orange-600">Invitado</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isOwner && !participant.user && (
                        <Button
                          onClick={() => {
                            setSelectedParticipant(participant);
                            setShowLinkGuestModal(true);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <LinkIcon className="w-4 h-4 mr-1" />
                          Vincular
                        </Button>
                      )}
                      {isOwner && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // Edit simple: prompt para nombre y email de invitado
                            if (participant.user) return; // no editar usuarios registrados
                            const newName = window.prompt(
                              "Nuevo nombre",
                              participant.guest_name || ""
                            );
                            if (newName === null) return;
                            const newEmail = window.prompt(
                              "Nuevo email (opcional)",
                              participant.guest_email || ""
                            );
                            try {
                              await groupsApi.updateParticipant(
                                group.id,
                                participant.id,
                                {
                                  guest_name: newName || undefined,
                                  guest_email: newEmail || undefined,
                                }
                              );
                              addToast({
                                title: "Participante actualizado",
                                type: "success",
                              });
                              fetchGroupDetail();
                            } catch (e) {
                              addToast({
                                title: "Error al actualizar participante",
                                type: "error",
                              });
                            }
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      {isOwner && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!confirm("¿Eliminar participante?")) return;
                            try {
                              await groupsApi.removeParticipant(
                                group.id,
                                participant.id
                              );
                              addToast({
                                title: "Participante eliminado",
                                type: "success",
                              });
                              fetchGroupDetail();
                            } catch (e) {
                              addToast({
                                title: "Error al eliminar participante",
                                type: "error",
                              });
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>

          {/* Current Month Payments */}
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Pagos del Mes ({currentMonthPayments.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/groups/${id}/payments`)}
                >
                  Ver pagadores
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                {currentMonthPayments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No hay pagos este mes
                  </p>
                ) : (
                  currentMonthPayments.map((payment) => {
                    const participantName = payment.participant
                      ? getParticipantName(payment.participant)
                      : payment.user?.full_name || "Desconocido";

                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            {payment.is_verified ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-600" />
                            ) : (
                              <ClockIcon className="w-4 h-4 text-yellow-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {participantName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {format(
                                new Date(payment.payment_date),
                                "dd/MM/yyyy"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            €{payment.amount}
                          </p>
                          <Badge
                            variant={
                              payment.is_verified ? "success" : "warning"
                            }
                            size="sm"
                          >
                            {payment.is_verified ? "Verificado" : "Pendiente"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Overdue Participants */}
        {overdueParticipants.length > 0 && (
          <Card>
            <Card.Header>
              <h3 className="text-lg font-medium text-red-600 flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                Participantes con Retraso ({overdueParticipants.length})
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                {overdueParticipants.map((overdue) => (
                  <div
                    key={overdue.participant.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {getParticipantName(overdue.participant)}
                        </p>
                        <p className="text-sm text-red-600">
                          {overdue.days_overdue} días de retraso
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">
                        €{overdue.amount_owed}
                      </p>
                      {overdue.last_payment_date && (
                        <p className="text-sm text-gray-500">
                          Último:{" "}
                          {format(
                            new Date(overdue.last_payment_date),
                            "dd/MM/yyyy"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Add Guest Modal */}
      <Modal
        isOpen={showAddGuestModal}
        onClose={() => setShowAddGuestModal(false)}
        title="Añadir Participante Invitado"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={guestForm.guest_name}
            onChange={(e) =>
              setGuestForm({ ...guestForm, guest_name: e.target.value })
            }
            required
          />
          <Input
            label="Email (opcional)"
            type="email"
            value={guestForm.guest_email}
            onChange={(e) =>
              setGuestForm({ ...guestForm, guest_email: e.target.value })
            }
          />
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => setShowAddGuestModal(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button onClick={handleAddGuest} disabled={!guestForm.guest_name}>
              Añadir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Link Guest Modal */}
      <Modal
        isOpen={showLinkGuestModal}
        onClose={() => setShowLinkGuestModal(false)}
        title="Vincular Participante"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Vincular a{" "}
            <strong>
              {selectedParticipant && getParticipantName(selectedParticipant)}
            </strong>{" "}
            con un usuario registrado:
          </p>
          <div className="space-y-2">
            {registeredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <Button onClick={() => handleLinkGuest(user.id)} size="sm">
                  Vincular
                </Button>
              </div>
            ))}
          </div>
          {registeredUsers.length === 0 && (
            <p className="text-gray-500 text-center py-4">
              No hay usuarios disponibles para vincular
            </p>
          )}
        </div>
      </Modal>

      {/* Add Payment Modal */}
      <Modal
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        title="Añadir Pago"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Participante
            </label>
            <select
              value={paymentForm.participant_id}
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  participant_id: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Seleccionar participante</option>
              {group.participants?.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {getParticipantName(participant)}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Cantidad"
            type="number"
            step="0.01"
            value={paymentForm.amount}
            onChange={(e) =>
              setPaymentForm({ ...paymentForm, amount: e.target.value })
            }
            required
          />
          <Input
            label="Notas (opcional)"
            value={paymentForm.notes}
            onChange={(e) =>
              setPaymentForm({ ...paymentForm, notes: e.target.value })
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprobante (imagen)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setReceiptFile(
                  e.target.files && e.target.files[0] ? e.target.files[0] : null
                )
              }
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Opcional. Se sube como comprobante del pago.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => setShowAddPaymentModal(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={!paymentForm.participant_id || !paymentForm.amount}
            >
              Añadir Pago
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default GroupDetailPage;
