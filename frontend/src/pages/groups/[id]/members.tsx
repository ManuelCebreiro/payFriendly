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
import { groupsApi } from "@/lib/api";
import type { Group, Participant } from "@/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

const GroupMembersPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { addToast } = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Estados para edición de miembros
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] =
    useState<Participant | null>(null);
  const [editForm, setEditForm] = useState({
    guest_name: "",
    guest_email: "",
  });

  useEffect(() => {
    if (id) {
      fetchGroupData();
    }
  }, [id]);

  const fetchGroupData = async () => {
    try {
      const groupId = parseInt(id as string);
      const [groupResponse, participantsResponse] = await Promise.all([
        groupsApi.getGroup(groupId),
        groupsApi.getParticipants(groupId),
      ]);
      setGroup(groupResponse.data);
      setParticipants(participantsResponse.data);
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar los datos del grupo",
      });
      router.push("/groups");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      // Aquí iría la lógica para invitar miembros
      // Por ahora simulamos el éxito
      addToast({
        type: "success",
        title: "Invitación enviada",
        message: `Se ha enviado una invitación a ${inviteEmail}`,
      });
      setShowInviteModal(false);
      setInviteEmail("");
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo enviar la invitación",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (participantId: number) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este miembro?")) {
      return;
    }

    try {
      const groupId = parseInt(id as string);
      await groupsApi.removeParticipant(groupId, participantId);
      setParticipants(participants.filter((p) => p.id !== participantId));
      addToast({
        type: "success",
        title: "Miembro eliminado",
        message: "El miembro ha sido eliminado del grupo",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo eliminar el miembro",
      });
    }
  };

  // Función para abrir modal de edición
  const handleEditMember = (participant: Participant) => {
    setEditingParticipant(participant);
    setEditForm({
      guest_name: participant.guest_name || "",
      guest_email: participant.guest_email || "",
    });
    setShowEditModal(true);
  };

  // Función para guardar cambios del miembro
  const handleSaveEdit = async () => {
    if (!editingParticipant || !editForm.guest_name.trim()) return;

    try {
      const groupId = parseInt(id as string);
      await groupsApi.updateParticipant(
        groupId,
        editingParticipant.id,
        editForm
      );

      // Actualizar la lista local
      setParticipants(
        participants.map((p) =>
          p.id === editingParticipant.id ? { ...p, ...editForm } : p
        )
      );

      addToast({
        type: "success",
        title: "Miembro actualizado",
        message: "Los datos del miembro han sido actualizados",
      });

      setShowEditModal(false);
      setEditingParticipant(null);
      setEditForm({ guest_name: "", guest_email: "" });
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo actualizar el miembro",
      });
    }
  };

  const isOwner = group?.owner_id === user?.id;

  if (loading) {
    return (
      <Layout>
        <Loading size="lg" text="Cargando miembros del grupo..." />
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">
            Grupo no encontrado
          </h3>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard?groupId=${id}`)}
              className="flex items-center"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Volver al Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Miembros de {group.name}
              </h1>
              <p className="text-gray-600">
                Gestiona los miembros de este grupo
              </p>
            </div>
          </div>
          {isOwner && (
            <Button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Invitar Miembro
            </Button>
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

        {/* Group Info */}
        <Card>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Descripción</p>
                <p className="font-medium">
                  {group.description || "Sin descripción"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monto de pago</p>
                <p className="font-medium">${group.payment_amount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Frecuencia</p>
                <p className="font-medium">
                  {group.payment_frequency === "weekly"
                    ? "Semanal"
                    : group.payment_frequency === "monthly"
                    ? "Mensual"
                    : group.payment_frequency === "quarterly"
                    ? "Trimestral"
                    : "Anual"}
                </p>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Members List */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-medium text-gray-900">
              Miembros ({participants.length})
            </h3>
          </Card.Header>
          <Card.Body>
            {participants.length > 0 ? (
              <div className="space-y-4">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-primary-600" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            {participant.user?.full_name ||
                              participant.guest_name ||
                              "Invitado"}
                          </h4>
                          {participant.user &&
                            participant.user.id === group.owner_id && (
                              <Badge variant="info" size="sm">
                                Propietario
                              </Badge>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {participant.user?.email ||
                            participant.guest_email ||
                            ""}
                        </p>
                        <p className="text-xs text-gray-400">
                          Se unió el{" "}
                          {format(
                            new Date(participant.joined_at),
                            "dd/MM/yyyy",
                            {
                              locale: es,
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={participant.is_active ? "success" : "gray"}
                        size="sm"
                      >
                        {participant.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                      {isOwner &&
                        (!participant.user ||
                          participant.user.id !== group.owner_id) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditMember(participant)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMember(participant.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No hay miembros
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Invita a personas para que se unan a este grupo.
                </p>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Edit Member Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingParticipant(null);
            setEditForm({ guest_name: "", guest_email: "" });
          }}
          title="Editar Miembro"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <Input
                type="text"
                value={editForm.guest_name}
                onChange={(e) =>
                  setEditForm((prev) => ({
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
                value={editForm.guest_email}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    guest_email: e.target.value,
                  }))
                }
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingParticipant(null);
                  setEditForm({ guest_name: "", guest_email: "" });
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editForm.guest_name.trim()}
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>

        {/* Invite Modal */}
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Invitar Miembro"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Envía una invitación por correo electrónico para que se una al
              grupo.
            </p>
            <Input
              label="Correo electrónico"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              required
            />
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setShowInviteModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleInviteMember}
                loading={inviting}
                disabled={!inviteEmail.trim()}
              >
                Enviar Invitación
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default GroupMembersPage;
