import { getSheetsData } from "@/lib/sheets";
import {
  calculateDashboardMetrics,
  groupByExecutive,
  groupComplianceByManager,
  groupComplianceByBusinessUnit,
} from "@/lib/calculations";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const HUBSPOT_PORTAL_ID = "48294971";

function buildTicketUrl(ticketId: string) {
  if (!ticketId) return "#";
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/ticket/${ticketId}`;
}

function getAlertStyle(alertType: string) {
  if (alertType.includes("5+")) {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }

  if (alertType.includes("3/4")) {
    return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  }

  return "bg-slate-500/10 text-slate-300 border-slate-500/20";
}

export default async function HomePage() {
  const { updatedAt, data } = await getSheetsData();

  const tickets = data.Tickets_Processed || [];
  const alerts = data.Alertas_Activas || [];
  const teamMapping = data.Team_Mapping || [];

  const metrics = calculateDashboardMetrics(tickets);
  const executives = groupByExecutive(tickets).slice(0, 12);
  const complianceByManager = groupComplianceByManager(tickets, teamMapping);
  const complianceByBusinessUnit = groupComplianceByBusinessUnit(
    tickets,
    teamMapping
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Escala 24x7
          </p>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">
                Ticket to Pipeline Dashboard
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Fuente de Datos: HubSpot CRM
              </p>

              <p className="text-sm text-slate-400">
                Última actualización:{" "}
                {new Date(updatedAt).toLocaleString("es-CO")}
              </p>
            </div>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Vista ejecutiva · SLA y conversión comercial
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Tickets" value={formatNumber(metrics.totalTickets)} />
          <KpiCard title="Convertidos" value={formatNumber(metrics.converted)} />
          <KpiCard title="Conversión" value={`${metrics.conversionRate}%`} />
          <KpiCard
            title="Pipeline asociado"
            value={formatCurrency(metrics.pipeline)}
          />
          <KpiCard title="Pendientes" value={formatNumber(metrics.pending)} />
          <KpiCard title="Por expirar" value={formatNumber(metrics.expiring)} />
          <KpiCard title="Expirados" value={formatNumber(metrics.expired)} />
          <KpiCard title="Alertas activas" value={formatNumber(alerts.length)} />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.15fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Performance por ejecutivo
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Ranking por pipeline asociado y volumen de tickets.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pb-3">Ejecutivo</th>
                    <th className="pb-3">Equipo</th>
                    <th className="pb-3 text-right">Tickets</th>
                    <th className="pb-3 text-right">Conv.</th>
                    <th className="pb-3 text-right">Tasa</th>
                    <th className="pb-3 text-right">Pipeline</th>
                  </tr>
                </thead>

                <tbody>
                  {executives.map((row) => (
                    <tr
                      key={row.executive}
                      className="border-t border-slate-800"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">{row.executive}</div>
                        <div className="text-xs text-slate-400">
                          {row.businessUnit} · {row.region}
                        </div>
                      </td>

                      <td className="py-3 pr-4">{row.team}</td>

                      <td className="py-3 text-right">
                        {formatNumber(row.tickets)}
                      </td>

                      <td className="py-3 text-right">
                        {formatNumber(row.converted)}
                      </td>

                      <td className="py-3 text-right">
                        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                          {row.conversionRate}%
                        </span>
                      </td>

                      <td className="py-3 text-right font-medium">
                        {formatCurrency(row.pipeline)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Alertas activas</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Tickets sin negocio asociado que requieren seguimiento.
                </p>
              </div>

              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm text-red-300">
                {alerts.length} abiertas
              </span>
            </div>

            <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {alerts.slice(0, 12).map((alert, index) => {
                const ticketId = alert["Ticket ID"] || "";
                const ticketUrl = buildTicketUrl(ticketId);
                const alertType = alert["Tipo alerta"] || "Alerta activa";
                const alertStyle = getAlertStyle(alertType);

                return (
                  <article
                    key={`${ticketId}-${index}`}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <a
                          href={ticketUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-base font-medium leading-snug text-white hover:text-emerald-300"
                        >
                          {alert["Ticket"] || "Ticket sin nombre"}
                        </a>

                        <p className="mt-1 text-xs text-slate-400">
                          {alert["Ejecutivo"] || "Sin ejecutivo"} ·{" "}
                          {alert["Región"] || "Sin región"} ·{" "}
                          {alert["Estado SLA"] || "Sin SLA"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs ${alertStyle}`}
                      >
                        {alertType}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-3">
                      <AlertDetail
                        label="Días desde creación"
                        value={alert["Días"] || "-"}
                      />
                      <AlertDetail
                        label="Account Manager"
                        value={alert["Account Manager"] || "-"}
                      />
                      <AlertDetail
                        label="Líder"
                        value={alert["Líder"] || "-"}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
                      <p className="text-xs text-slate-500">
                        Ticket ID: {ticketId || "-"}
                      </p>

                      <a
                        href={ticketUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Abrir en HubSpot
                      </a>
                    </div>
                  </article>
                );
              })}

              {alerts.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
                  <p className="text-sm text-slate-400">
                    Sin alertas activas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <ComplianceCard
            title="Cumplimiento por equipo gestor"
            description="Tickets gestionados frente a la meta esperada a la fecha."
            rows={complianceByManager}
          />

          <ComplianceCard
            title="Cumplimiento por unidad de negocio"
            description="Avance de cumplimiento agrupado por unidad de negocio."
            rows={complianceByBusinessUnit}
          />
        </section>
      </section>
    </main>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function AlertDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-slate-200">{value}</p>
    </div>
  );
}

function ComplianceCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{
    name: string;
    actual: number;
    target: number;
    complianceRate: number;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const progress = Math.min(row.complianceRate, 100);

          return (
            <div
              key={row.name}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{row.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatNumber(row.actual)} tickets / meta{" "}
                    {formatNumber(row.target)}
                  </p>
                </div>

                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
                  {row.complianceRate}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
            <p className="text-sm text-slate-400">
              Sin datos disponibles para calcular cumplimiento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}