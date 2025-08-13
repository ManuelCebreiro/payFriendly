import { Layout } from "@/components/layout";
import { Badge, Button, Card, Loading, useToast, Modal, Input } from "@/components/ui";
import { groupsApi, paymentsApi } from "@/lib/api";
import type { Group, Participant, Payment } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

const GroupPaymentsPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { addToast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, notes: "", receipt: null as File | null });

  const navLink = (href: string, label: string, active: boolean) => (
    <Button
      key={href}
      variant={active ? "primary" : "outline"}
      size="sm"
      onClick={() => router.push(href)}
    >
      {label}
    </Button>
  );

  useEffect(() => {
    if (!id) return;
    const groupId = parseInt(id as string);
    const load = async () => {
      try {
        const [g, p] = await Promise.all([
          groupsApi.getGroup(groupId),
          paymentsApi.getGroupPayments(groupId, 0, 100),
        ]);
        setGroup(g.data);
        setPayments(p.data);
      } catch (e) {
        addToast({
          type: "error",
          title: "Error",
          message: "No se pudieron cargar los pagos",
        });
        router.push("/groups");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const getParticipantName = (payment: Payment) => {
    const participant: Participant | undefined = payment.participant as any;
    if (participant) {
      return (
        participant.user?.full_name || participant.guest_name || "Invitado"
      );
    }
    return payment.user?.full_name || "Desconocido";
  };

  if (loading) {
    return (
      <Layout>
        <Loading size="lg" text="Cargando pagadores..." />
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="text-center py-12">No se encontró el grupo</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard?groupId=${id}`)}
              className="flex items-center"
            >
              ← Volver al Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Pagadores - {group.name}
              </h1>
              <p className="text-gray-600">Listado de pagos del grupo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {navLink(`/groups/${id}`, "Resumen", false)}
            {navLink(`/groups/${id}/members`, "Miembros", false)}
            {navLink(`/groups/${id}/payments`, "Pagadores", true)}
          </div>
        </div>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Pagos recientes
              </h3>
              <Badge variant="info" size="sm">
                {payments.length}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay pagos registrados aún.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getParticipantName(p)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(p.payment_date), "dd/MM/yyyy HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.receipt_url && (
                        <a
                          href={p.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 underline"
                        >
                          Comprobante
                        </a>
                      )}
                      <Badge
                        variant={p.is_verified ? "success" : "warning"}
                        size="sm"
                      >
                        {p.is_verified ? "Verificado" : "Pendiente"}
                      </Badge>
                      <Badge variant="success" size="sm">
                        €{p.amount}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPayment(p);
                          setEditForm({
                            amount: p.amount,
                            notes: p.notes || "",
                            receipt: null
                          });
                        }}
                      >
                        ✏️ Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!confirm("¿Eliminar pago?")) return;
                          try {
                            await paymentsApi.deletePayment(p.id);
                            setPayments(payments.filter((x) => x.id !== p.id));
                            addToast({
                              type: "success",
                              title: "Pago eliminado",
                            });
                          } catch (e) {
                            addToast({
                              type: "error",
                              title: "Error al eliminar",
                            });
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Modal de edición */}
        <Modal
          isOpen={!!editingPayment}
          onClose={() => {
            setEditingPayment(null);
            setEditForm({ amount: 0, notes: "", receipt: null });
          }}
          title="Editar Pago"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comprobante (opcional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditForm({ ...editForm, receipt: e.target.files?.[0] || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {editingPayment?.receipt_url && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Comprobante actual:</p>
                  <a
                    href={editingPayment.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 underline"
                  >
                    Ver comprobante actual
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingPayment(null);
                  setEditForm({ amount: 0, notes: "", receipt: null });
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!editingPayment) return;
                  
                  const form = new FormData();
                  form.append("amount", String(editForm.amount));
                  if (editForm.notes.trim()) {
                    form.append("notes", editForm.notes);
                  }
                  if (editForm.receipt) {
                    form.append("receipt", editForm.receipt);
                  }
                  
                  try {
                    await paymentsApi.updatePayment(editingPayment.id, form);
                    addToast({
                      type: "success",
                      title: "Pago actualizado",
                      message: "El pago se ha actualizado correctamente"
                    });
                    
                    // Recargar los pagos
                    const refreshed = await paymentsApi.getGroupPayments(group!.id, 0, 100);
                    setPayments(refreshed.data);
                    
                    // Cerrar modal
                    setEditingPayment(null);
                    setEditForm({ amount: 0, notes: "", receipt: null });
                  } catch (e) {
                    addToast({
                      type: "error",
                      title: "Error al actualizar",
                      message: "No se pudo actualizar el pago"
                    });
                  }
                }}
              >
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default GroupPaymentsPage;
