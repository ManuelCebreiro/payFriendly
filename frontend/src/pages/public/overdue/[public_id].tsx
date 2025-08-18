import { ClockIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { PublicOverdueResponse } from "../../../types";

// Get base URL from environment (without /api for public endpoints)
const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
).replace("/api", "");

// Using types from ../../../types/index.ts

const PublicOverduePage: NextPage = () => {
  const router = useRouter();
  const { public_id } = router.query;
  const [data, setData] = useState<PublicOverdueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (public_id) {
      fetchOverdueData();
    }
  }, [public_id]);

  const fetchOverdueData = async () => {
    if (!public_id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${BASE_URL}/public/overdue/${public_id}`);

      if (!response.ok) {
        throw new Error("Error al cargar los datos");
      }

      const responseData = await response.json();
      setData(responseData);
    } catch (error) {
      console.error("Error fetching overdue data:", error);
      setError("Error al cargar los datos del grupo");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información del grupo...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error || "Grupo no encontrado"}
          </h1>
          <p className="text-gray-600">
            {error || "El grupo que buscas no existe o no está disponible."}
          </p>
        </div>
      </div>
    );
  }

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case "weekly":
        return "Semanal";
      case "biweekly":
        return "Quincenal";
      case "monthly":
        return "Mensual";
      case "quarterly":
        return "Trimestral";
      case "yearly":
        return "Anual";
      default:
        return frequency.charAt(0).toUpperCase() + frequency.slice(1);
    }
  };

  const { group_info: groupInfo, overdue_participants: overdueParticipants } =
    data;

  const sortedOverdue = [...overdueParticipants].sort(
    (a, b) => b.days_since_last - a.days_since_last
  );

  // Obtener los últimos 2 participantes para OpenGraph
  const lastTwoParticipants = sortedOverdue
    .slice(0, 2)
    .map((p) => p.name)
    .join(", ");
  const ogDescription = `Faltan €${groupInfo.pending_amount} por aportar. Últimos participantes: ${lastTwoParticipants}`;

  return (
    <>
      <Head>
        <title>{`Aportes Pendientes - ${groupInfo.name}`}</title>
        <meta name="description" content={ogDescription} />

        {/* OpenGraph tags */}
        <meta
          property="og:title"
          content={`Aportes Pendientes - ${groupInfo.name}`}
        />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content={`${
            typeof window !== "undefined" ? window.location.origin : ""
          }/public/overdue/${public_id}`}
        />
        <meta
          property="og:image"
          content={`${
            typeof window !== "undefined" ? window.location.origin : ""
          }/og-overdue.png`}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="PayControl" />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={`Aportes Pendientes - ${groupInfo.name}`}
        />
        <meta name="twitter:description" content={ogDescription} />
        <meta
          name="twitter:image"
          content={`${
            typeof window !== "undefined" ? window.location.origin : ""
          }/og-overdue.png`}
        />

        {/* Additional meta tags */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {groupInfo.name}
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Próximos aportadores del siguiente período -{" "}
              {getFrequencyText(groupInfo.payment_frequency)}
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              <ClockIcon className="w-4 h-4 mr-2" />
              {overdueParticipants.length} posibles aportadores
            </div>
          </div>

          {/* Group Info */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Información del Grupo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  €{groupInfo.payment_amount || 0}
                </div>
                <div className="text-sm text-gray-500">
                  Cantidad por período
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {getFrequencyText(groupInfo.payment_frequency)}
                </div>
                <div className="text-sm text-gray-500">
                  Frecuencia de aporte
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {groupInfo.total_participants || 0}
                </div>
                <div className="text-sm text-gray-500">Participantes</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  €{groupInfo.pending_amount || 0}
                </div>
                <div className="text-sm text-gray-500">
                  Cantidad pendiente por aportar
                </div>
              </div>
            </div>
          </div>

          {/* Overdue List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Quienes llevan más tiempo sin aportar
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Ordenados por tiempo transcurrido desde el último pago
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {sortedOverdue.length > 0 ? (
                sortedOverdue.map((participant, index) => (
                  <div
                    key={index}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-600 font-semibold text-lg">
                              {index + 1}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {participant.name}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center">
                              <ClockIcon className="w-4 h-4 mr-1" />
                              {participant.days_since_last} días sin aportar
                            </span>
                            {participant.last_payment_date && (
                              <span>
                                Último aporte:{" "}
                                {format(
                                  new Date(participant.last_payment_date),
                                  "dd/MM/yyyy",
                                  { locale: es }
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-700">
                          Participante
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    ¡Todos los aportes están al día!
                  </h3>
                  <p className="text-gray-600">
                    No hay participantes pendientes en este grupo.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Esta página se actualiza automáticamente. Última actualización:{" "}
              {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PublicOverduePage;
