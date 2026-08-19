"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ExecutivePerformance,
  TargetCompliance,
  TicketDetail,
} from "@/lib/calculations";
import { formatCurrency, formatNumber } from "@/lib/formatters";

const HUBSPOT_PORTAL_ID = "48294971";
const ICON_BASE = "/icons/ticket-dashboard";

type DashboardMetrics = {
  totalTickets: number;
  converted: number;
  discarded: number;
  expiring: number;
  expired: number;
  pending: number;
  pipeline: number;
  conversionRate: number;
};

type PageKey = "overview" | "team" | "businessUnit" | "region";


function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha disponible";
  }

  // Colombia no usa horario de verano: UTC-5.
  // Lo formateamos manualmente para evitar errores de hidratación entre servidor y navegador.
  const colombiaDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const pad = (number: number) => String(number).padStart(2, "0");

  const day = pad(colombiaDate.getUTCDate());
  const month = pad(colombiaDate.getUTCMonth() + 1);
  const year = colombiaDate.getUTCFullYear();
  const hours = pad(colombiaDate.getUTCHours());
  const minutes = pad(colombiaDate.getUTCMinutes());

  return `${day}/${month}/${year}, ${hours}:${minutes} COL`;
}

type Props = {
  updatedAt: string;
  metrics: DashboardMetrics;
  alertsCount: number;
  executives: ExecutivePerformance[];
  complianceByManager: TargetCompliance[];
  complianceByBusinessUnit: TargetCompliance[];
  complianceByRegion: TargetCompliance[];
};

const pages: { key: PageKey; label: string; eyebrow: string; icon: string }[] = [
  {
    key: "overview",
    label: "Resumen general",
    eyebrow: "Vista ejecutiva",
    icon: `${ICON_BASE}/01_tickets_gestionados.png`,
  },
  {
    key: "team",
    label: "Equipo gestor",
    eyebrow: "Cumplimiento",
    icon: `${ICON_BASE}/09_cumplimiento_equipo_base.png`,
  },
  {
    key: "businessUnit",
    label: "Unidad de negocio",
    eyebrow: "Cumplimiento",
    icon: `${ICON_BASE}/10_unidades_base.png`,
  },
  {
    key: "region",
    label: "Región",
    eyebrow: "Cumplimiento",
    icon: `${ICON_BASE}/13_cumplimiento_por_unidad.png`,
  },
];

function buildTicketUrl(ticketId: string, existingUrl?: string) {
  if (existingUrl && existingUrl.startsWith("http")) return existingUrl;
  if (!ticketId) return "#";
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/ticket/${ticketId}`;
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

function total(rows: TargetCompliance[], key: keyof TargetCompliance) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function rate(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 100) : 0;
}

function conversion(converted: number, tickets: number) {
  return tickets > 0 ? Math.round((converted / tickets) * 100) : 0;
}

function complianceTone(value: number) {
  if (value >= 100) return "ok";
  if (value >= 50) return "warn";
  return "danger";
}

function complianceLabel(value: number) {
  if (value >= 100) return "Meta cumplida";
  if (value >= 50) return "En avance";
  return "Requiere acción";
}

function SourceStatusBox({
  updatedAt,
  totalTickets,
  convertedTickets,
}: {
  updatedAt: string;
  totalTickets: number;
  convertedTickets: number;
}) {
  return (
    <div className="source-card compact-source-card">
      <div className="source-info-icon">i</div>
      <div className="source-content">
        <p className="source-title-line">Fuente: <strong>HubSpot</strong></p>
        <p className="source-muted">Actualización</p>
        <p className="source-date">{formatUpdatedAt(updatedAt)}</p>
        <p className="source-copy">Google Sheets + Apps Script</p>
        <p className="source-copy">
          {formatNumber(totalTickets)} tickets actuales · {formatNumber(convertedTickets)} convertidos
        </p>
      </div>
    </div>
  );
}

export default function DashboardClient({
  updatedAt,
  metrics,
  alertsCount,
  executives,
  complianceByManager,
  complianceByBusinessUnit,
  complianceByRegion,
}: Props) {
  const [activePage, setActivePage] = useState<PageKey>("overview");

  const topExecutives = useMemo(() => executives.slice(0, 12), [executives]);
  const currentPage = pages.find((page) => page.key === activePage) || pages[0];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">T2P</div>
          <div>
            <p className="brand-kicker">Escala 24x7</p>
            <h1>Ticket to Pipeline</h1>
          </div>
        </div>

        <nav className="side-nav" aria-label="Navegación principal">
          {pages.map((page) => (
            <button
              key={page.key}
              type="button"
              className={`side-nav-item ${activePage === page.key ? "active" : ""}`}
              onClick={() => setActivePage(page.key)}
            >
              <img src={page.icon} alt="" />
              <span>
                <small>{page.eyebrow}</small>
                {page.label}
              </span>
            </button>
          ))}
        </nav>

        <SourceStatusBox
          updatedAt={updatedAt}
          totalTickets={metrics.totalTickets}
          convertedTickets={metrics.converted}
        />
      </aside>

      <section className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">{currentPage.eyebrow}</p>
            <h2>{currentPage.label}</h2>
            <p className="page-description">
              Dashboard de Gestión CPSM, TAM, COM. Las metas de cumplimiento se muestran contra la meta anual.
            </p>
          </div>

          <a className="top-logout-button" href="/api/logout">
            Cerrar sesión
          </a>
        </header>

        {activePage === "overview" && (
          <OverviewPage
            metrics={metrics}
            alertsCount={alertsCount}
            executives={topExecutives}
          />
        )}

        {activePage === "team" && (
          <CompliancePage
            title="Cumplimiento de gestión por equipo"
            description="Compara los tickets gestionados por cada equipo frente a su meta anual. Incluye cantidad esperada, conversión y pipeline asociado."
            rows={complianceByManager}
            icon={`${ICON_BASE}/09_cumplimiento_equipo_base.png`}
            breakdownLabel="Detalle de contribución individual"
          />
        )}

        {activePage === "businessUnit" && (
          <CompliancePage
            title="Cumplimiento por unidad de negocio"
            description="Coteja la gestión actual contra las metas anuales por unidad. Cloud EMx: 456 tickets y US$ 9,5MM de pipeline. One Time: 336 tickets y US$ 7MM de pipeline."
            rows={complianceByBusinessUnit}
            icon={`${ICON_BASE}/10_unidades_base.png`}
            breakdownLabel="Contribución por ejecutivo"
          />
        )}

        {activePage === "region" && (
          <CompliancePage
            title="Cumplimiento de gestión por región"
            description="Mide el avance regional frente a la meta anual, con conversión y pipeline asociado a los tickets convertidos."
            rows={complianceByRegion}
            icon={`${ICON_BASE}/13_cumplimiento_por_unidad.png`}
            breakdownLabel="Contribución por unidad de negocio"
          />
        )}
      </section>
    </main>
  );
}

function OverviewPage({
  metrics,
  alertsCount,
  executives,
}: {
  metrics: DashboardMetrics;
  alertsCount: number;
  executives: ExecutivePerformance[];
}) {
  const kpis = [
    {
      title: "Tickets generados en total",
      value: formatNumber(metrics.totalTickets),
      description: "Total de tickets válidos recibidos en el flujo Ticket to Pipeline.",
      icon: `${ICON_BASE}/01_tickets_gestionados.png`,
      tone: "blue",
    },
    {
      title: "Tickets convertidos a oportunidad",
      value: formatNumber(metrics.converted),
      description: "Tickets que ya tienen una oportunidad/deal asociado en HubSpot.",
      icon: `${ICON_BASE}/02_tickets_convertidos.png`,
      tone: "teal",
    },
    {
      title: "Efectividad comercial",
      value: `${metrics.conversionRate}%`,
      description: "Porcentaje de tickets generados que se convirtieron en oportunidad comercial.",
      icon: `${ICON_BASE}/03_efectividad_comercial.png`,
      tone: "green",
    },
    {
      title: "Pipeline asociado a tickets convertidos",
      value: formatCompactCurrency(metrics.pipeline),
      description: "Valor de pipeline asociado a los tickets convertidos en oportunidad.",
      icon: `${ICON_BASE}/04_pipeline_asociado.png`,
      tone: "purple",
    },
    {
      title: "En gestión",
      value: formatNumber(metrics.pending),
      description: "Tickets abiertos que siguen pendientes de avance, conversión o descarte.",
      icon: `${ICON_BASE}/05_en_gestion.png`,
      tone: "navy",
    },
    {
      title: "Por expirar",
      value: formatNumber(metrics.expiring),
      description: "Tickets cercanos al vencimiento del SLA y que requieren acción preventiva.",
      icon: `${ICON_BASE}/06_por_expirar.png`,
      tone: "amber",
    },
    {
      title: "Expirados",
      value: formatNumber(metrics.expired),
      description: "Tickets que superaron el tiempo esperado de gestión sin conversión o descarte.",
      icon: `${ICON_BASE}/07_expirados.png`,
      tone: "red",
    },
    {
      title: "Alertas activas",
      value: formatNumber(alertsCount),
      description: "Alertas vigentes por SLA, expiración o problemas de mapeo operativo.",
      icon: `${ICON_BASE}/08_alertas_activas.png`,
      tone: "rose",
    },
  ];

  return (
    <>
      <section className="kpi-grid overview-kpis">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </section>

      <GoalsClarityPanel metrics={metrics} />

      <RankingSection
        title="Ranking general"
        description="Lectura rápida de los líderes por tickets creados/gestionados, tickets convertidos y pipeline asociado."
        items={executives.map((executive) => ({
          name: executive.executive,
          tickets: executive.tickets,
          convertedTickets: executive.converted,
          pipeline: executive.pipeline,
        }))}
      />

      <section className="panel performance-panel">
        <PanelHeader
          icon={`${ICON_BASE}/11_performance_individual.png`}
          title="Performance individual"
          description="Ranking por pipeline asociado, tickets gestionados, cumplimiento anual de gestión y efectividad comercial. Se conserva la funcionalidad actual de detalle por estado."
          aside={`Top ${executives.length} ejecutivos`}
        />

        <div className="executive-grid">
          {executives.map((executive) => (
            <ExecutiveCard key={executive.executive} row={executive} />
          ))}
        </div>

        {executives.length === 0 && <EmptyState text="Sin datos disponibles para performance individual." />}
      </section>
    </>
  );
}

function GoalsClarityPanel({ metrics }: { metrics: DashboardMetrics }) {
  const totalTicketTarget = 792;
  const totalPipelineTarget = 16500000;
  const ticketRate = rate(metrics.totalTickets, totalTicketTarget);
  const pipelineRate = rate(metrics.pipeline, totalPipelineTarget);

  const territoryGoals = [
    { name: "SOLA", value: "US$ 7MM", tone: "green" },
    { name: "NOLA", value: "US$ 5MM", tone: "blue" },
    { name: "MX", value: "US$ 2,5MM", tone: "purple" },
    { name: "Caribe", value: "US$ 2MM", tone: "teal" },
  ];

  return (
    <section className="goals-panel annual-goals-panel">
      <PanelHeader
        icon={`${ICON_BASE}/12_cumplimiento_por_gestor.png`}
        title="Metas anuales"
        description="Las metas se miden de forma anual por tickets gestionados y pipeline asociado."
        aside="Meta anual"
      />

      <div className="goal-summary-grid annual-goal-summary-grid">
        <div className="goal-summary-card highlighted">
          <span>Meta individual</span>
          <strong>24 tickets · US$ 500K</strong>
          <p>Por cada persona incluida en meta.</p>
        </div>
        <div className="goal-summary-card">
          <span>Cloud EMx</span>
          <strong>456 tickets · US$ 9,5MM</strong>
          <p>Meta anual de la unidad.</p>
        </div>
        <div className="goal-summary-card">
          <span>One Time</span>
          <strong>336 tickets · US$ 7MM</strong>
          <p>Meta anual de la unidad.</p>
        </div>
        <div className="goal-summary-card">
          <span>Avance general tickets</span>
          <strong>{ticketRate}%</strong>
          <p>{formatNumber(metrics.totalTickets)} de {formatNumber(totalTicketTarget)} tickets anuales.</p>
        </div>
        <div className="goal-summary-card">
          <span>Avance general pipeline</span>
          <strong>{pipelineRate}%</strong>
          <p>{formatCompactCurrency(metrics.pipeline)} de {formatCompactCurrency(totalPipelineTarget)}.</p>
        </div>
      </div>

      <div className="territory-goals-panel">
        <div className="territory-headline">
          <span>Metas de pipeline por territorio</span>
          <p>Se usan para calcular cumplimiento regional de pipeline.</p>
        </div>

        <div className="territory-goal-grid">
          {territoryGoals.map((goal) => (
            <article className={`territory-goal-card territory-${goal.tone}`} key={goal.name}>
              <div className="territory-icon">◎</div>
              <div>
                <span>{goal.name}</span>
                <strong>{goal.value}</strong>
                <p>Meta anual de pipeline regional.</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompliancePage({
  title,
  description,
  rows,
  icon,
  breakdownLabel,
}: {
  title: string;
  description: string;
  rows: TargetCompliance[];
  icon: string;
  breakdownLabel: string;
}) {
  const actualTickets = total(rows, "actualTickets");
  const targetTickets = total(rows, "targetTickets");
  const convertedTickets = total(rows, "convertedTickets");
  const actualPipeline = total(rows, "actualPipeline");
  const targetPipeline = total(rows, "targetPipeline");
  const complianceRate = rate(actualTickets, targetTickets);
  const pipelineComplianceRate = rate(actualPipeline, targetPipeline);

  return (
    <>
      <section className="kpi-grid compliance-kpis">
        <KpiCard
          title="Tickets gestionados"
          value={formatNumber(actualTickets)}
          description="Cantidad de tickets registrados para esta vista."
          icon={`${ICON_BASE}/01_tickets_gestionados.png`}
          tone="blue"
        />
        <KpiCard
          title="Tickets esperados"
          value={formatNumber(targetTickets)}
          description="Meta anual definida para la agrupación seleccionada."
          icon={`${ICON_BASE}/12_cumplimiento_por_gestor.png`}
          tone="teal"
        />
        <KpiCard
          title="Cumplimiento anual"
          value={`${complianceRate}%`}
          description="Tickets gestionados divididos entre tickets esperados anuales."
          icon={icon}
          tone={complianceRate >= 100 ? "green" : complianceRate >= 50 ? "amber" : "red"}
        />
        <KpiCard
          title="Pipeline asociado"
          value={formatCompactCurrency(actualPipeline)}
          description="Pipeline asociado a los tickets convertidos en oportunidad."
          icon={`${ICON_BASE}/04_pipeline_asociado.png`}
          tone="purple"
        />
        <KpiCard
          title="Meta pipeline anual"
          value={formatCompactCurrency(targetPipeline)}
          description="Meta anual de pipeline para esta vista."
          icon={`${ICON_BASE}/04_pipeline_asociado.png`}
          tone="purple"
        />
        <KpiCard
          title="Cumplimiento pipeline"
          value={`${pipelineComplianceRate}%`}
          description="Pipeline asociado dividido entre la meta anual de pipeline."
          icon={`${ICON_BASE}/03_efectividad_comercial.png`}
          tone={pipelineComplianceRate >= 100 ? "green" : pipelineComplianceRate >= 50 ? "amber" : "red"}
        />
        <KpiCard
          title="Tickets convertidos"
          value={formatNumber(convertedTickets)}
          description="Cantidad de tickets convertidos a oportunidad."
          icon={`${ICON_BASE}/02_tickets_convertidos.png`}
          tone="green"
        />
        <KpiCard
          title="Efectividad"
          value={`${conversion(convertedTickets, actualTickets)}%`}
          description="Tickets convertidos sobre tickets gestionados."
          icon={`${ICON_BASE}/03_efectividad_comercial.png`}
          tone="navy"
        />
      </section>

      <RankingSection
        title="Ranking de cumplimiento"
        description="Ordena esta vista por tickets creados/gestionados, tickets convertidos y pipeline asociado."
        items={rows.map((row) => ({
          name: row.name,
          tickets: row.actualTickets,
          convertedTickets: row.convertedTickets,
          pipeline: row.actualPipeline,
        }))}
      />

      <section className="panel">
        <PanelHeader icon={icon} title={title} description={description} aside="Meta anual" />

        <div className="compliance-list">
          {rows.map((row) => (
            <ComplianceCard key={row.name} row={row} breakdownLabel={breakdownLabel} />
          ))}
        </div>

        {rows.length === 0 && <EmptyState text="Sin datos disponibles para calcular cumplimiento." />}
      </section>
    </>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
  tone: string;
}) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-icon-wrap">
        <img src={icon} alt="" className="kpi-icon" />
      </div>
      <div>
        <p className="kpi-title">{title}</p>
        <p className="kpi-value">{value}</p>
        <p className="kpi-description">{description}</p>
      </div>
    </article>
  );
}

function PanelHeader({
  icon,
  title,
  description,
  aside,
}: {
  icon: string;
  title: string;
  description: string;
  aside?: string;
}) {
  return (
    <div className="panel-head">
      <div className="panel-title-block">
        <img src={icon} alt="" className="panel-icon" />
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {aside && <span className="panel-badge">{aside}</span>}
    </div>
  );
}

function ExecutiveCard({ row }: { row: ExecutivePerformance }) {
  const [openBucket, setOpenBucket] = useState<string | null>(null);

  const ticketProgress = Math.min(row.complianceRate, 100);
  const pipelineProgress = Math.min(row.pipelineComplianceRate, 100);
  const ticketsNeeded = Math.max(Number(row.target6M || 0) - Number(row.tickets || 0), 0);
  const ticketTone = complianceTone(row.complianceRate);
  const pipelineTone = complianceTone(row.pipelineComplianceRate);

  function toggleBucket(bucketKey: string) {
    setOpenBucket((current) => (current === bucketKey ? null : bucketKey));
  }

  return (
    <article className="executive-card refined-executive-card">
      <div className="card-topline refined-card-topline">
        <div>
          <h4>{row.executive}</h4>
          <p>{row.team || "Sin equipo"} · {row.businessUnit || "Sin unidad"} · {row.region || "Sin región"}</p>
        </div>
        <span className={`status-pill ${ticketTone}`}>
          {row.complianceRate}%
        </span>
      </div>

      <div className="progress-block main-progress-block">
        <div>
          <span>Cumplimiento anual tickets: {formatNumber(row.tickets)} / {formatNumber(row.target6M)}</span>
          <span className={`status-pill progress-pill ${ticketTone}`}>{complianceLabel(row.complianceRate)}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${ticketProgress}%` }} />
        </div>
      </div>

      <div className="mini-grid four executive-ticket-summary">
        <MiniMetric label="Gestionados" value={formatNumber(row.tickets)} />
        <MiniMetric label="Convertidos" value={formatNumber(row.converted)} />
        <MiniMetric label="Efectividad comercial" value={`${row.conversionRate}%`} />
        <MiniMetric label="Necesarios para meta" value={formatNumber(ticketsNeeded)} />
      </div>

      <div className="progress-block secondary pipeline-progress-block">
        <div>
          <span>Cumplimiento pipeline: {formatCompactCurrency(row.pipeline)} / {formatCompactCurrency(row.targetPipeline)}</span>
          <span className={`status-pill progress-pill ${pipelineTone}`}>{row.pipelineComplianceRate}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill pipeline" style={{ width: `${pipelineProgress}%` }} />
        </div>
      </div>

      <div className="mini-grid two executive-pipeline-summary">
        <MiniMetric label="Pipeline" value={formatCompactCurrency(row.pipeline)} />
        <MiniMetric label="Meta pipeline" value={formatCompactCurrency(row.targetPipeline)} />
      </div>

      <div className="ticket-buckets refined-ticket-buckets">
        <TicketBucketDetails
          bucketKey="converted"
          title="Convertidos"
          count={row.converted}
          tickets={row.details.converted || []}
          tone="green"
          isOpen={openBucket === "converted"}
          onToggle={toggleBucket}
        />
        <TicketBucketDetails
          bucketKey="waiting"
          title="En gestión"
          count={row.waiting}
          tickets={row.details.waiting || []}
          tone="blue"
          isOpen={openBucket === "waiting"}
          onToggle={toggleBucket}
        />
        <TicketBucketDetails
          bucketKey="alerts"
          title="Alertas activas"
          count={row.expired + row.expiring}
          tickets={[...(row.details.expired || []), ...(row.details.expiring || [])]}
          tone="red"
          isOpen={openBucket === "alerts"}
          onToggle={toggleBucket}
        />
        <TicketBucketDetails
          bucketKey="discarded"
          title="Descartados"
          count={row.discarded}
          tickets={row.details.discarded || []}
          tone="slate"
          isOpen={openBucket === "discarded"}
          onToggle={toggleBucket}
        />
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TicketBucketDetails({
  bucketKey,
  title,
  count,
  tickets,
  tone,
  isOpen,
  onToggle,
}: {
  bucketKey: string;
  title: string;
  count: number;
  tickets: TicketDetail[];
  tone: "green" | "blue" | "red" | "slate";
  isOpen: boolean;
  onToggle: (bucketKey: string) => void;
}) {
  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const modal = isOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          className="ticket-detail-modal-backdrop"
          role="presentation"
          onClick={() => onToggle(bucketKey)}
        >
          <div
            className="ticket-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ticket-detail-panel-head">
              <div>
                <span>Detalle</span>
                <strong>{title}</strong>
              </div>
              <button type="button" onClick={() => onToggle(bucketKey)} aria-label="Cerrar detalle">
                ×
              </button>
            </div>

            <div className="ticket-detail-list">
              {safeTickets.slice(0, 10).map((ticket, index) => (
                <TicketDetailItem key={`${ticket.id}-${index}`} ticket={ticket} />
              ))}

              {safeTickets.length > 10 && (
                <p className="more-note">Se muestran 10 de {formatNumber(safeTickets.length)} tickets.</p>
              )}

              {safeTickets.length === 0 && <p className="more-note">Sin tickets en esta categoría.</p>}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={`bucket-details bucket-popover ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="bucket-trigger"
        aria-expanded={isOpen}
        onClick={() => onToggle(bucketKey)}
      >
        <span>{title}</span>
        <strong className={`bucket-count ${tone}`}>{formatNumber(count)}</strong>
      </button>
      {modal}
    </div>
  );
}

function TicketDetailItem({ ticket }: { ticket: TicketDetail }) {
  const ticketUrl = buildTicketUrl(ticket.id, ticket.url);

  return (
    <article className="ticket-detail-item">
      <div>
        <a href={ticketUrl} target="_blank" rel="noreferrer">
          {ticket.name}
        </a>
        <p>{ticket.company || "Sin empresa"}</p>
      </div>
      <div className="ticket-detail-meta">
        <span>{ticket.slaStatus || "Sin SLA"}</span>
        <span>{formatCompactCurrency(ticket.pipeline)}</span>
      </div>
      {ticket.description && (
        <details className="description-details">
          <summary>Ver descripción</summary>
          <p>{ticket.description}</p>
        </details>
      )}
    </article>
  );
}

function ComplianceCard({
  row,
  breakdownLabel,
}: {
  row: TargetCompliance;
  breakdownLabel: string;
}) {
  const progress = Math.min(row.ticketComplianceRate, 100);

  return (
    <details className="compliance-card">
      <summary>
        <div>
          <h4>{row.name}</h4>
          <p>{formatNumber(row.actualTickets)} tickets de {formatNumber(row.targetTickets)} esperados · {formatCompactCurrency(row.actualPipeline)} de {formatCompactCurrency(row.targetPipeline)}</p>
        </div>
        <span className={`status-pill ${complianceTone(row.ticketComplianceRate)}`}>
          {row.ticketComplianceRate}%
        </span>
      </summary>

      <div className="compliance-body">
        <div className="progress-block">
          <div>
            <span>Cumplimiento tickets: {formatNumber(row.actualTickets)} / {formatNumber(row.targetTickets)}</span>
            <span>{complianceLabel(row.ticketComplianceRate)}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="progress-block secondary">
          <div>
            <span>Cumplimiento pipeline: {formatCompactCurrency(row.actualPipeline)} / {formatCompactCurrency(row.targetPipeline)}</span>
            <span className={`status-pill progress-pill ${complianceTone(row.pipelineComplianceRate)}`}>{row.pipelineComplianceRate}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill pipeline" style={{ width: `${Math.min(row.pipelineComplianceRate, 100)}%` }} />
          </div>
        </div>

        <div className="mini-grid six">
          <MiniMetric label="Tickets" value={formatNumber(row.actualTickets)} />
          <MiniMetric label="Meta tickets" value={formatNumber(row.targetTickets)} />
          <MiniMetric label="Cumpl. tickets" value={`${row.ticketComplianceRate}%`} />
          <MiniMetric label="Convertidos" value={formatNumber(row.convertedTickets)} />
          <MiniMetric label="Pipeline" value={formatCompactCurrency(row.actualPipeline)} />
          <MiniMetric label="Meta pipeline" value={formatCompactCurrency(row.targetPipeline)} />
        </div>

        <div className="breakdown-table-wrap">
          <h5>{breakdownLabel}</h5>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tickets</th>
                <th>Convertidos</th>
                <th>Efectividad</th>
                <th>Pipeline</th>
                <th>Participación</th>
              </tr>
            </thead>
            <tbody>
              {row.breakdown.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{formatNumber(item.tickets)}</td>
                  <td>{formatNumber(item.convertedTickets)}</td>
                  <td>{item.conversionRate}%</td>
                  <td>{formatCompactCurrency(item.pipeline)}</td>
                  <td>{item.shareRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {row.breakdown.length === 0 && <EmptyState text="Sin detalle disponible." />}
        </div>
      </div>
    </details>
  );
}

type RankingItem = {
  name: string;
  tickets: number;
  convertedTickets: number;
  pipeline: number;
};

function RankingSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: RankingItem[];
}) {
  const byTickets = [...items]
    .sort((a, b) => b.tickets - a.tickets || b.pipeline - a.pipeline)
    .slice(0, 5);

  const byConverted = [...items]
    .sort((a, b) => b.convertedTickets - a.convertedTickets || b.pipeline - a.pipeline)
    .slice(0, 5);

  const byPipeline = [...items]
    .sort((a, b) => b.pipeline - a.pipeline || b.tickets - a.tickets)
    .slice(0, 5);

  return (
    <section className="panel ranking-section">
      <PanelHeader
        icon={`${ICON_BASE}/03_efectividad_comercial.png`}
        title={title}
        description={description}
        aside="Top 5"
      />

      <div className="ranking-grid">
        <RankingList title="Tickets creados" items={byTickets} metric="tickets" />
        <RankingList title="Tickets convertidos" items={byConverted} metric="converted" />
        <RankingList title="Pipeline asociado" items={byPipeline} metric="pipeline" />
      </div>
    </section>
  );
}

function RankingList({
  title,
  items,
  metric,
}: {
  title: string;
  items: RankingItem[];
  metric: "tickets" | "converted" | "pipeline";
}) {
  return (
    <div className="ranking-card">
      <h4>{title}</h4>

      <div className="ranking-list">
        {items.map((item, index) => {
          const value =
            metric === "tickets"
              ? formatNumber(item.tickets)
              : metric === "converted"
                ? formatNumber(item.convertedTickets)
                : formatCompactCurrency(item.pipeline);

          return (
            <div className="ranking-row" key={`${title}-${item.name}`}>
              <span className="ranking-position">#{index + 1}</span>
              <span className="ranking-name">{item.name}</span>
              <strong>{value}</strong>
            </div>
          );
        })}

        {items.length === 0 && <p className="more-note">Sin datos disponibles.</p>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
