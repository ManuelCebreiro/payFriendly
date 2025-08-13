import { Layout } from "@/components/layout";
import { Badge, Card, Loading } from "@/components/ui";
import { useToast } from "@/components/ui/ToastContainer";
import { useAuth } from "@/contexts/AuthContext";
import { paymentsApi } from "@/lib/api";
import { Payment } from "@/types";
import {
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import React, { useEffect, useState } from "react";

const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    notes: "",
    receipt: null as File | null,
  });

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await paymentsApi.getMyPayments(0, 100);
      setPayments(response.data);
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudieron cargar los pagos",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowReceiptModal(true);
  };

  const handleEditPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setEditForm({
      amount: payment.amount.toString(),
      notes: payment.notes || "",
      receipt: null,
    });
    setShowEditModal(true);
  };

  const handleUpdatePayment = async () => {
    if (!selectedPayment) return;

    try {
      const formData = new FormData();
      if (editForm.amount) {
        formData.append("amount", editForm.amount);
      }
      if (editForm.notes) {
        formData.append("notes", editForm.notes);
      }
      if (editForm.receipt) {
        formData.append("receipt", editForm.receipt);
      }

      await paymentsApi.updatePayment(selectedPayment.id, formData);

      addToast({
        type: "success",
        title: "Éxito",
        message: "Pago actualizado correctamente",
      });

      setShowEditModal(false);
      await fetchPayments();
    } catch (error) {
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo actualizar el pago",
      });
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    console.log("handleDeletePayment called with payment:", payment);

    if (!confirm("¿Estás seguro de que quieres eliminar este pago?")) {
      console.log("User cancelled deletion");
      return;
    }

    console.log("Attempting to delete payment with ID:", payment.id);
    try {
      const response = await paymentsApi.deletePayment(payment.id);
      console.log("Delete response:", response);

      addToast({
        type: "success",
        title: "Éxito",
        message: "Pago eliminado correctamente",
      });

      await fetchPayments();
    } catch (error) {
      console.error("Delete error:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "No se pudo eliminar el pago",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading size="lg" text="Cargando historial de pagos..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Historial de Pagos
          </h1>
          <p className="text-gray-600">
            Aquí puedes ver todos tus pagos realizados
          </p>
        </div>

        {/* Payments Table */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-medium text-gray-900">
              Todos los Pagos ({payments.length})
            </h3>
          </Card.Header>
          <Card.Body className="p-0">
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grupo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Comprobante
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(
                            new Date(payment.payment_date),
                            "dd/MM/yyyy HH:mm",
                            { locale: es }
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary-600">
                                  {payment.user?.full_name
                                    ?.split(" ")
                                    ?.map((n) => n[0])
                                    ?.join("") || "?"}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {payment.user?.full_name ||
                                  "Usuario desconocido"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {payment.user?.email || "Email no disponible"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Grupo #{payment.group_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-green-600">
                            €{payment.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              payment.is_verified ? "success" : "warning"
                            }
                            size="sm"
                          >
                            {payment.is_verified ? (
                              <>
                                <CheckCircleIcon className="w-3 h-3 mr-1" />
                                Verificado
                              </>
                            ) : (
                              <>
                                <ClockIcon className="w-3 h-3 mr-1" />
                                Pendiente
                              </>
                            )}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {payment.receipt_url ? (
                            <button
                              onClick={() => handleViewReceipt(payment)}
                              className="text-primary-600 hover:text-primary-900 flex items-center"
                            >
                              <PhotoIcon className="w-4 h-4 mr-1" />
                              Ver
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">
                              Sin comprobante
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {payment.notes || (
                              <span className="text-gray-400">Sin notas</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditPayment(payment)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                              title="Editar pago"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(payment)}
                              className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                              title="Eliminar pago"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <ClockIcon className="h-12 w-12" />
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No hay pagos registrados
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Cuando realices pagos, aparecerán aquí.
                </p>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Receipt Modal */}
        {showReceiptModal && selectedPayment && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Comprobante de Pago
                  </h3>
                  <button
                    onClick={() => setShowReceiptModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <strong>Fecha:</strong>{" "}
                      {format(
                        new Date(selectedPayment.payment_date),
                        "dd/MM/yyyy HH:mm",
                        { locale: es }
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Monto:</strong> €{selectedPayment.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Usuario:</strong>{" "}
                      {selectedPayment.user?.full_name || "Usuario desconocido"}
                    </p>
                    {selectedPayment.notes && (
                      <p className="text-sm text-gray-600">
                        <strong>Notas:</strong> {selectedPayment.notes}
                      </p>
                    )}
                  </div>
                  {selectedPayment.receipt_url && (
                    <div className="mt-4">
                      <img
                        src={selectedPayment.receipt_url}
                        alt="Comprobante de pago"
                        className="max-w-full h-auto rounded-lg shadow-md"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedPayment && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Editar Pago
                  </h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm({ ...editForm, amount: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas
                    </label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, notes: e.target.value })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nuevo Comprobante (opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          receipt: e.target.files?.[0] || null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdatePayment}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PaymentsPage;
