import { getSheetsData } from "@/lib/sheets";
import {
  calculateDashboardMetrics,
  groupByExecutive,
  groupComplianceByManager,
  groupComplianceByBusinessUnit,
  type ExecutivePerformance,
  type TicketDetail,
} from "@/lib/calculations";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const HUBSPOT_PORTAL_ID = "48294971";

function buildTicketUrl(ticketId: string, existingUrl?: string) {
  if (existingUrl && existingUrl.startsWith("http")) return existingUrl;
  if (!ticketId) return "#";
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/ticket/${ticketId}`;
}

function getComplianceStyle(rate: number) {
  if (rate >= 90) {
    return {
      pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      bar: "bg-emerald-400",
      label: "En ritmo",
    };
  }

  if (rate >= 70) {
    return {
      pill: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      bar: "bg-amber-400",
      label: "En observación",
    };
  }

  return {
    pill: "border-red-500/30 bg-red-500/10 text-red-300",
    bar: "bg-red-400",
    label: "Requiere acción",
  };
}

function formatCompactCurrency(value: number) {
  const absValue = Math.abs(value);

  if (absValue >= 1000000) {
    return `US$ ${(value / 1000000).toFixed(1).replace(".0", "")}M`;
  }

  if (absValue >= 1000) {
    return `US$ ${(value / 1000).toFixed(0)}K`;
  }

  return formatCurrency(value);
}

export default async function HomePage() {
  const { updatedAt, data } = await getSheetsData();

  const tickets = data.Tickets_Processed || [];
  const alerts = data.Alertas_Activas || [];
  const teamMapping = data.Team_Mapping || [];
  const goalsConfig = data.Goals_Config || [];
  const dashboardRows = data.Dashboard || [];

  const metrics = calculateDashboardMetrics(tickets);
  const executives = groupByExecutive(
    tickets,
    teamMapping,
    goalsConfig,
    dashboardRows
  ).slice(0, 12);

  const complianceByManager = groupComplianceByManager(tickets, teamMapping);
  const complianceByBusinessUnit = groupComplianceByBusinessUnit(
    tickets,
    teamMapping
  );

  return (
    <main className="min-h-screen bg-[#020817] text-white">
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
                Fuente de datos: HubSpot
              </p>

              <p className="text-sm text-slate-400">
                Última actualización:{" "}
                {new Date(updatedAt).toLocaleString("es-CO")}
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
              Vista ejecutiva · SLA y conversión comercial
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Tickets"
            value={formatNumber(metrics.totalTickets)}
            tone="emerald"
          />
          <KpiCard
            title="Convertidos"
            value={formatNumber(metrics.converted)}
            tone="cyan"
          />
          <KpiCard
            title="Conversión"
            value={`${metrics.conversionRate}%`}
            tone="blue"
          />
          <KpiCard
            title="Pipeline asociado"
            value={formatCompactCurrency(metrics.pipeline)}
            tone="violet"
          />
          <KpiCard
            title="Pendientes"
            value={formatNumber(metrics.pending)}
            tone="slate"
          />
          <KpiCard
            title="Por expirar"
            value={formatNumber(metrics.expiring)}
            tone="amber"
          />
          <KpiCard
            title="Expirados"
            value={formatNumber(metrics.expired)}
            tone="red"
          />
          <KpiCard
            title="Alertas activas"
            value={formatNumber(alerts.length)}
            tone="rose"
          />
        </section>

        <section className="mt-8">
          <div className="rounded-3xl border border-cyan-400/15 bg-slate-900/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.08)]">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Performance Individual
                </h2>

                <p className="mt-1 max-w-3xl text-sm text-slate-400">
                  Ranking por pipeline asociado, tickets gestionados y
                  cumplimiento frente a meta semestral prorrateada.
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                Top {executives.length} ejecutivos
              </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              {executives.map((executive) => (
                <ExecutiveCard key={executive.executive} row={executive} />
              ))}
            </div>

            {executives.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
                <p className="text-sm text-slate-400">
                  Sin datos disponibles para performance individual.
                </p>
              </div>
            )}
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

function KpiCard({
  title,
  value,
  tone = "emerald",
}: {
  title: string;
  value: string;
  tone?:
    | "emerald"
    | "cyan"
    | "blue"
    | "violet"
    | "slate"
    | "amber"
    | "red"
    | "rose";
}) {
  const toneClasses = {
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.08)]",
    cyan:
      "border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.08)]",
    blue:
      "border-blue-400/20 bg-blue-400/[0.07] text-blue-300 shadow-[0_0_24px_rgba(96,165,250,0.08)]",
    violet:
      "border-violet-400/20 bg-violet-400/[0.07] text-violet-300 shadow-[0_0_24px_rgba(167,139,250,0.08)]",
    slate: "border-slate-500/20 bg-slate-500/[0.07] text-slate-300",
    amber:
      "border-amber-400/20 bg-amber-400/[0.07] text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.08)]",
    red:
      "border-red-400/20 bg-red-400/[0.07] text-red-300 shadow-[0_0_24px_rgba(248,113,113,0.08)]",
    rose:
      "border-rose-400/20 bg-rose-400/[0.07] text-rose-300 shadow-[0_0_24px_rgba(251,113,133,0.08)]",
  };

  return (
    <div className={`rounded-2xl border p-5 ${toneClasses[tone]}`}>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function ExecutiveCard({ row }: { row: ExecutivePerformance }) {
  const style = getComplianceStyle(row.complianceRate);
  const progress = Math.min(row.complianceRate, 100);

  return (
    <article className="rounded-3xl border border-cyan-400/15 bg-[#020817] p-5 shadow-[0_0_28px_rgba(34,211,238,0.06)] transition hover:border-emerald-400/30 hover:shadow-[0_0_32px_rgba(52,211,153,0.10)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-semibold text-white">
            {row.executive}
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {row.team || "Sin equipo"} · {row.businessUnit || "Sin unidad"} ·{" "}
            {row.region || "Sin región"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`inline-flex rounded-full border px-4 py-1.5 text-sm font-semibold ${style.pill}`}
          >
            {row.complianceRate}%
          </span>

          <p className="mt-1 text-xs text-slate-500">{style.label}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <MiniMetric label="Tickets" value={formatNumber(row.tickets)} />
        <MiniMetric label="Convertidos" value={formatNumber(row.converted)} />
        <MiniMetric
          label="Pipeline"
          value={formatCompactCurrency(row.pipeline)}
        />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>Meta 6M: {formatNumber(row.target6M)}</span>
          <span>Avance: {formatNumber(row.tickets)}</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${style.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-slate-900/60 p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white">
            Detalle operativo por estado
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Consulta los tickets convertidos, en espera, con alerta activa o
            descartados.
          </p>
        </div>

        <div className="space-y-2">
          <TicketBucketDetails
            title="Convertidos"
            count={row.converted}
            tickets={row.details.converted}
            badgeClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          />

          <TicketBucketDetails
            title="En espera"
            count={row.waiting}
            tickets={row.details.waiting}
            badgeClass="border-sky-500/20 bg-sky-500/10 text-sky-300"
          />

          <TicketBucketDetails
            title="Alertas activas"
            count={row.expired}
            tickets={row.details.expired}
            badgeClass="border-red-500/20 bg-red-500/10 text-red-300"
          />

          <TicketBucketDetails
            title="Descartados"
            count={row.discarded}
            tickets={row.details.discarded}
            badgeClass="border-slate-500/20 bg-slate-500/10 text-slate-300"
          />
        </div>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-cyan-400/10 bg-slate-900/60 p-3">
      <p className="truncate text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 truncate text-base font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function TicketBucketDetails({
  title,
  count,
  tickets,
  badgeClass,
}: {
  title: string;
  count: number;
  tickets: TicketDetail[];
  badgeClass: string;
}) {
  return (
    <details className="rounded-2xl border border-slate-700/70 bg-[#020817] p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-white outline-none focus:outline-none">
        <span>{title}</span>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs ${badgeClass}`}
        >
          {formatNumber(count)}
        </span>
      </summary>

      <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
        {tickets.slice(0, 10).map((ticket, index) => (
          <TicketDetailItem key={`${ticket.id}-${index}`} ticket={ticket} />
        ))}

        {tickets.length > 10 && (
          <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
            Se muestran 10 de {formatNumber(tickets.length)} tickets. Para ver
            el universo completo, consulta la fuente en Google Sheets.
          </p>
        )}

        {tickets.length === 0 && (
          <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
            Sin tickets en esta categoría.
          </p>
        )}
      </div>
    </details>
  );
}

function TicketDetailItem({ ticket }: { ticket: TicketDetail }) {
  const ticketUrl = buildTicketUrl(ticket.id, ticket.url);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={ticketUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            {ticket.name}
          </a>

          <p className="mt-1 truncate text-xs text-slate-400">
            {ticket.company || "Sin empresa"}
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300">
          {ticket.slaStatus || "Sin SLA"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <span>Días: {ticket.days || "-"}</span>
        <span>Pipeline: {formatCompactCurrency(ticket.pipeline)}</span>
        <span>ID: {ticket.id || "-"}</span>
      </div>

      <div className="mt-3 rounded-xl border border-cyan-400/10 bg-slate-900/70 p-3">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
          Descripción del ticket
        </p>

        <p
          className="text-xs leading-relaxed text-slate-300"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {ticket.description || "Sin descripción registrada."}
        </p>

        {ticket.description && (
          <details className="mt-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-emerald-300 hover:text-emerald-200">
              Ver descripción completa
            </summary>

            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
              {ticket.description}
            </p>
          </details>
        )}
      </div>

      <div className="mt-3">
        <a
          href={ticketUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
        >
          Abrir en HubSpot
        </a>
      </div>
    </article>
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
    <div className="rounded-3xl border border-cyan-400/15 bg-slate-900/80 p-5 shadow-[0_0_32px_rgba(34,211,238,0.06)]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const progress = Math.min(row.complianceRate, 100);
          const style = getComplianceStyle(row.complianceRate);

          return (
            <div
              key={row.name}
              className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{row.name}</p>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatNumber(row.actual)} tickets / meta{" "}
                    {formatNumber(row.target)}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-sm font-medium ${style.pill}`}
                >
                  {row.complianceRate}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${style.bar}`}
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