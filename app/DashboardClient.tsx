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


type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "converted" | "waiting" | "alerts" | "discarded";

type ExecutiveSortKey =
  | "executive"
  | "tickets"
  | "converted"
  | "conversionRate"
  | "pipeline"
  | "complianceRate"
  | "pipelineComplianceRate"
  | "alerts";

type ComplianceSortKey =
  | "name"
  | "actualTickets"
  | "convertedTickets"
  | "conversionRate"
  | "actualPipeline"
  | "ticketComplianceRate"
  | "pipelineComplianceRate";

function normalizeForSearch(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueOptions(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "es"));
}

function allExecutiveTickets(row: ExecutivePerformance): TicketDetail[] {
  const maybeExpiring = (row.details as { expiring?: TicketDetail[] }).expiring || [];

  return [
    ...(row.details.converted || []),
    ...(row.details.waiting || []),
    ...(row.details.expired || []),
    ...(row.details.discarded || []),
    ...maybeExpiring,
  ];
}

function executiveSearchText(row: ExecutivePerformance) {
  const tickets = allExecutiveTickets(row)
    .map((ticket) =>
      [
        ticket.id,
        ticket.name,
        ticket.company,
        ticket.description,
        ticket.slaStatus,
        ticket.businessUnit,
        ticket.region,
        ticket.team,
        ticket.executive,
      ].join(" ")
    )
    .join(" ");

  return normalizeForSearch(
    [
      row.executive,
      row.team,
      row.businessUnit,
      row.region,
      row.tickets,
      row.converted,
      row.pipeline,
      tickets,
    ].join(" ")
  );
}

function matchesExecutiveStatus(row: ExecutivePerformance, status: StatusFilter) {
  if (status === "all") return true;
  if (status === "converted") return row.converted > 0;
  if (status === "waiting") return row.waiting > 0;
  if (status === "alerts") return row.expired + row.expiring > 0;
  if (status === "discarded") return row.discarded > 0;
  return true;
}

function filterExecutives(
  executives: ExecutivePerformance[],
  filters: {
    query: string;
    region: string;
    team: string;
    businessUnit: string;
    status: StatusFilter;
  }
) {
  const query = normalizeForSearch(filters.query);

  return executives.filter((row) => {
    const matchesQuery = !query || executiveSearchText(row).includes(query);
    const matchesRegion = !filters.region || row.region === filters.region;
    const matchesTeam = !filters.team || row.team === filters.team;
    const matchesUnit = !filters.businessUnit || row.businessUnit === filters.businessUnit;
    const matchesStatus = matchesExecutiveStatus(row, filters.status);

    return matchesQuery && matchesRegion && matchesTeam && matchesUnit && matchesStatus;
  });
}

function sortExecutives(
  rows: ExecutivePerformance[],
  sortKey: ExecutiveSortKey,
  direction: SortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortKey === "executive") {
      return a.executive.localeCompare(b.executive, "es") * multiplier;
    }

    const getValue = (row: ExecutivePerformance) => {
      if (sortKey === "alerts") return row.expired + row.expiring;
      return Number(row[sortKey] || 0);
    };

    return (getValue(a) - getValue(b)) * multiplier || a.executive.localeCompare(b.executive, "es");
  });
}

function filterComplianceRows(rows: TargetCompliance[], query: string) {
  const normalizedQuery = normalizeForSearch(query);

  if (!normalizedQuery) return rows;

  return rows.filter((row) => {
    const breakdownText = row.breakdown
      .map((item) => [item.name, item.tickets, item.convertedTickets, item.pipeline].join(" "))
      .join(" ");

    return normalizeForSearch([row.name, breakdownText].join(" ")).includes(normalizedQuery);
  });
}

function sortComplianceRows(
  rows: TargetCompliance[],
  sortKey: ComplianceSortKey,
  direction: SortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "es") * multiplier;
    }

    return (Number(a[sortKey] || 0) - Number(b[sortKey] || 0)) * multiplier;
  });
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    start: rows.length === 0 ? 0 : start + 1,
    end: Math.min(start + pageSize, rows.length),
  };
}

function toggleDirection(currentKey: string, nextKey: string, direction: SortDirection): SortDirection {
  if (currentKey !== nextKey) return "desc";
  return direction === "asc" ? "desc" : "asc";
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
            executives={executives}
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
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [team, setTeam] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<ExecutiveSortKey>("pipeline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const filteredExecutives = useMemo(
    () =>
      filterExecutives(executives, {
        query,
        region,
        team,
        businessUnit,
        status,
      }),
    [executives, query, region, team, businessUnit, status]
  );

  const sortedExecutives = useMemo(
    () => sortExecutives(filteredExecutives, sortKey, sortDirection),
    [filteredExecutives, sortKey, sortDirection]
  );

  const pagedExecutives = paginate(sortedExecutives, page, pageSize);

  const options = useMemo(
    () => ({
      regions: uniqueOptions(executives.map((row) => row.region)),
      teams: uniqueOptions(executives.map((row) => row.team)),
      businessUnits: uniqueOptions(executives.map((row) => row.businessUnit)),
    }),
    [executives]
  );

  function handleExecutiveSort(nextKey: ExecutiveSortKey) {
    setSortDirection(toggleDirection(sortKey, nextKey, sortDirection));
    setSortKey(nextKey);
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setRegion("");
    setTeam("");
    setBusinessUnit("");
    setStatus("all");
    setPage(1);
  }

  return (
    <>
      <section className="kpi-grid overview-kpis">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </section>

      <section className="panel performance-panel">
        <PanelHeader
          icon={`${ICON_BASE}/11_performance_individual.png`}
          title="Performance individual"
          description="Consulta el desempeño por ejecutivo. Usa búsqueda, filtros y ordenamiento para priorizar por cumplimiento, pipeline, tickets o alertas."
          aside={`${formatNumber(filteredExecutives.length)} ejecutivos`}
        />

        <ExplorerToolbar
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          queryPlaceholder="Buscar ejecutivo, cuenta, ticket, deal o empresa..."
          region={region}
          onRegionChange={(value) => {
            setRegion(value);
            setPage(1);
          }}
          team={team}
          onTeamChange={(value) => {
            setTeam(value);
            setPage(1);
          }}
          businessUnit={businessUnit}
          onBusinessUnitChange={(value) => {
            setBusinessUnit(value);
            setPage(1);
          }}
          status={status}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={options}
          onReset={resetFilters}
        />

        <div className="sort-bar">
          <span>Ordenar por</span>
          <SortButton active={sortKey === "executive"} direction={sortDirection} onClick={() => handleExecutiveSort("executive")}>Nombre</SortButton>
          <SortButton active={sortKey === "complianceRate"} direction={sortDirection} onClick={() => handleExecutiveSort("complianceRate")}>Cumpl. tickets</SortButton>
          <SortButton active={sortKey === "pipelineComplianceRate"} direction={sortDirection} onClick={() => handleExecutiveSort("pipelineComplianceRate")}>Cumpl. pipeline</SortButton>
          <SortButton active={sortKey === "tickets"} direction={sortDirection} onClick={() => handleExecutiveSort("tickets")}>Tickets</SortButton>
          <SortButton active={sortKey === "converted"} direction={sortDirection} onClick={() => handleExecutiveSort("converted")}>Convertidos</SortButton>
          <SortButton active={sortKey === "pipeline"} direction={sortDirection} onClick={() => handleExecutiveSort("pipeline")}>Pipeline</SortButton>
          <SortButton active={sortKey === "alerts"} direction={sortDirection} onClick={() => handleExecutiveSort("alerts")}>Alertas</SortButton>
        </div>

        <div className="executive-grid compact-executive-grid">
          {pagedExecutives.rows.map((executive) => (
            <ExecutiveCard key={executive.executive} row={executive} />
          ))}
        </div>

        <PaginationControls
          page={pagedExecutives.page}
          totalPages={pagedExecutives.totalPages}
          pageSize={pageSize}
          totalItems={sortedExecutives.length}
          start={pagedExecutives.start}
          end={pagedExecutives.end}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />

        {sortedExecutives.length === 0 && <EmptyState text="Sin resultados con los filtros seleccionados." />}
      </section>
    </>
  );
}

function ExplorerToolbar({
  query,
  onQueryChange,
  queryPlaceholder,
  region,
  onRegionChange,
  team,
  onTeamChange,
  businessUnit,
  onBusinessUnitChange,
  status,
  onStatusChange,
  options,
  onReset,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  queryPlaceholder: string;
  region: string;
  onRegionChange: (value: string) => void;
  team: string;
  onTeamChange: (value: string) => void;
  businessUnit: string;
  onBusinessUnitChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  options: { regions: string[]; teams: string[]; businessUnits: string[] };
  onReset: () => void;
}) {
  return (
    <div className="explorer-toolbar">
      <label className="search-control">
        <span>Buscar</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={queryPlaceholder}
        />
      </label>

      <div className="filter-controls">
        <SelectControl label="Región" value={region} onChange={onRegionChange} options={options.regions} />
        <SelectControl label="Equipo" value={team} onChange={onTeamChange} options={options.teams} />
        <SelectControl label="Unidad" value={businessUnit} onChange={onBusinessUnitChange} options={options.businessUnits} />

        <label className="select-control">
          <span>Estado</span>
          <select value={status} onChange={(event) => onStatusChange(event.target.value as StatusFilter)}>
            <option value="all">Todos</option>
            <option value="converted">Convertidos</option>
            <option value="waiting">En gestión</option>
            <option value="alerts">Alertas activas</option>
            <option value="discarded">Descartados</option>
          </select>
        </label>

        <button type="button" className="clear-filters-button" onClick={onReset}>
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option value={option} key={`${label}-${option}`}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortButton({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`sort-button ${active ? "active" : ""}`} onClick={onClick}>
      {children}
      {active && <span>{direction === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

function PaginationControls({
  page,
  totalPages,
  pageSize,
  totalItems,
  start,
  end,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="pagination-controls">
      <p>
        Mostrando <strong>{formatNumber(start)}</strong>–<strong>{formatNumber(end)}</strong> de{" "}
        <strong>{formatNumber(totalItems)}</strong>
      </p>

      <div className="pagination-actions">
        <label>
          Ver
          <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>

        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          Anterior
        </button>
        <span>
          {formatNumber(page)} / {formatNumber(totalPages)}
        </span>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Siguiente
        </button>
      </div>
    </div>
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
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ComplianceSortKey>("actualPipeline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const actualTickets = total(rows, "actualTickets");
  const targetTickets = total(rows, "targetTickets");
  const convertedTickets = total(rows, "convertedTickets");
  const actualPipeline = total(rows, "actualPipeline");
  const targetPipeline = total(rows, "targetPipeline");
  const ticketComplianceRate = rate(actualTickets, targetTickets);
  const pipelineComplianceRate = rate(actualPipeline, targetPipeline);

  const filteredRows = useMemo(() => filterComplianceRows(rows, query), [rows, query]);
  const sortedRows = useMemo(
    () => sortComplianceRows(filteredRows, sortKey, sortDirection),
    [filteredRows, sortKey, sortDirection]
  );
  const pagedRows = paginate(sortedRows, page, pageSize);

  function handleSort(nextKey: ComplianceSortKey) {
    setSortDirection(toggleDirection(sortKey, nextKey, sortDirection));
    setSortKey(nextKey);
    setPage(1);
  }

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
          value={`${ticketComplianceRate}%`}
          description="Tickets gestionados divididos entre tickets esperados anuales."
          icon={`${ICON_BASE}/03_efectividad_comercial.png`}
          tone={ticketComplianceRate >= 100 ? "green" : ticketComplianceRate >= 50 ? "amber" : "red"}
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
          icon={`${ICON_BASE}/08_alertas_activas.png`}
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
<section className="panel">
        <PanelHeader icon={icon} title={title} description={description} aside="Meta anual" />

        <div className="compact-control-row">
          <label className="search-control">
            <span>Buscar</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar equipo, unidad, región o contribuidor..."
            />
          </label>
        </div>

        <div className="sort-bar">
          <span>Ordenar por</span>
          <SortButton active={sortKey === "name"} direction={sortDirection} onClick={() => handleSort("name")}>Nombre</SortButton>
          <SortButton active={sortKey === "actualTickets"} direction={sortDirection} onClick={() => handleSort("actualTickets")}>Tickets</SortButton>
          <SortButton active={sortKey === "convertedTickets"} direction={sortDirection} onClick={() => handleSort("convertedTickets")}>Convertidos</SortButton>
          <SortButton active={sortKey === "conversionRate"} direction={sortDirection} onClick={() => handleSort("conversionRate")}>Efectividad</SortButton>
          <SortButton active={sortKey === "actualPipeline"} direction={sortDirection} onClick={() => handleSort("actualPipeline")}>Pipeline</SortButton>
          <SortButton active={sortKey === "ticketComplianceRate"} direction={sortDirection} onClick={() => handleSort("ticketComplianceRate")}>Cumpl. tickets</SortButton>
          <SortButton active={sortKey === "pipelineComplianceRate"} direction={sortDirection} onClick={() => handleSort("pipelineComplianceRate")}>Cumpl. pipeline</SortButton>
        </div>

        <div className="compliance-list">
          {pagedRows.rows.map((row) => (
            <ComplianceCard key={row.name} row={row} breakdownLabel={breakdownLabel} />
          ))}
        </div>

        <PaginationControls
          page={pagedRows.page}
          totalPages={pagedRows.totalPages}
          pageSize={pageSize}
          totalItems={sortedRows.length}
          start={pagedRows.start}
          end={pagedRows.end}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />

        {sortedRows.length === 0 && <EmptyState text="Sin resultados con los filtros seleccionados." />}
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
  const [expanded, setExpanded] = useState(false);

  const ticketProgress = Math.min(row.complianceRate, 100);
  const pipelineProgress = Math.min(row.pipelineComplianceRate, 100);
  const ticketsNeeded = Math.max(Number(row.target6M || 0) - Number(row.tickets || 0), 0);
  const ticketTone = complianceTone(row.complianceRate);
  const pipelineTone = complianceTone(row.pipelineComplianceRate);
  const alertCount = row.expired + row.expiring;

  function toggleBucket(bucketKey: string) {
    setOpenBucket((current) => (current === bucketKey ? null : bucketKey));
  }

  return (
    <article className={`executive-card refined-executive-card interactive-executive-card ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="executive-summary-button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="card-topline refined-card-topline compact-card-topline">
          <div>
            <h4>{row.executive}</h4>
            <p>{row.team || "Sin equipo"} · {row.businessUnit || "Sin unidad"} · {row.region || "Sin región"}</p>
          </div>
          <span className="expand-hint">{expanded ? "Contraer" : "Ver detalle"}</span>
        </div>

        <div className="executive-compact-metrics">
          <div>
            <span>Cumplimiento tickets</span>
            <strong className={`status-pill ${ticketTone}`}>{row.complianceRate}%</strong>
            <small>{formatNumber(row.tickets)} / {formatNumber(row.target6M)} tickets</small>
          </div>
          <div>
            <span>Cumplimiento pipeline</span>
            <strong className={`status-pill ${pipelineTone}`}>{row.pipelineComplianceRate}%</strong>
            <small>{formatCompactCurrency(row.pipeline)} / {formatCompactCurrency(row.targetPipeline)}</small>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="executive-expanded-content">
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
              count={alertCount}
              tickets={[...(row.details.expired || []), ...(((row.details as { expiring?: TicketDetail[] }).expiring) || [])]}
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
        </div>
      )}
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
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "company" | "slaStatus" | "pipeline">("pipeline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const safeTickets = Array.isArray(tickets) ? tickets : [];

  const filteredTickets = safeTickets.filter((ticket) =>
    normalizeForSearch([
      ticket.name,
      ticket.company,
      ticket.description,
      ticket.slaStatus,
      ticket.pipeline,
      ticket.id,
    ].join(" ")).includes(normalizeForSearch(query))
  );

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    if (sortKey === "pipeline") {
      return (a.pipeline - b.pipeline) * multiplier;
    }

    return String(a[sortKey] || "").localeCompare(String(b[sortKey] || ""), "es") * multiplier;
  });

  const pagedTickets = paginate(sortedTickets, page, 5);

  function handleSort(nextKey: "name" | "company" | "slaStatus" | "pipeline") {
    setSortDirection(toggleDirection(sortKey, nextKey, sortDirection));
    setSortKey(nextKey);
    setPage(1);
  }

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

            <div className="modal-toolbar">
              <label className="search-control">
                <span>Buscar ticket</span>
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar ticket, cuenta, empresa o estado..."
                />
              </label>

              <div className="sort-bar compact">
                <span>Ordenar</span>
                <SortButton active={sortKey === "name"} direction={sortDirection} onClick={() => handleSort("name")}>Ticket</SortButton>
                <SortButton active={sortKey === "company"} direction={sortDirection} onClick={() => handleSort("company")}>Empresa</SortButton>
                <SortButton active={sortKey === "slaStatus"} direction={sortDirection} onClick={() => handleSort("slaStatus")}>Estado</SortButton>
                <SortButton active={sortKey === "pipeline"} direction={sortDirection} onClick={() => handleSort("pipeline")}>Pipeline</SortButton>
              </div>
            </div>

            <div className="ticket-detail-list">
              {pagedTickets.rows.map((ticket, index) => (
                <TicketDetailItem key={`${ticket.id}-${index}`} ticket={ticket} />
              ))}

              {pagedTickets.rows.length === 0 && <p className="more-note">Sin tickets en esta categoría.</p>}
            </div>

            <PaginationControls
              page={pagedTickets.page}
              totalPages={pagedTickets.totalPages}
              pageSize={5}
              totalItems={sortedTickets.length}
              start={pagedTickets.start}
              end={pagedTickets.end}
              onPageChange={setPage}
              onPageSizeChange={() => undefined}
            />
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

        <BreakdownTable title={breakdownLabel} rows={row.breakdown} />
      </div>
    </details>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: {
    name: string;
    tickets: number;
    convertedTickets: number;
    conversionRate: number;
    pipeline: number;
    shareRate: number;
  }[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "tickets" | "convertedTickets" | "conversionRate" | "pipeline" | "shareRate">("pipeline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRows = rows.filter((row) =>
    normalizeForSearch([row.name, row.tickets, row.convertedTickets, row.pipeline].join(" ")).includes(normalizeForSearch(query))
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "es") * multiplier;
    }

    return (Number(a[sortKey] || 0) - Number(b[sortKey] || 0)) * multiplier;
  });

  const pagedRows = paginate(sortedRows, page, pageSize);

  function handleSort(nextKey: "name" | "tickets" | "convertedTickets" | "conversionRate" | "pipeline" | "shareRate") {
    setSortDirection(toggleDirection(sortKey, nextKey, sortDirection));
    setSortKey(nextKey);
    setPage(1);
  }

  return (
    <div className="breakdown-table-wrap">
      <div className="table-headline">
        <h5>{title}</h5>
        <label className="search-control compact-search">
          <span>Buscar</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar contribuidor..."
          />
        </label>
      </div>

      <div className="table-scroll">
        <table className="data-table interactive-table">
          <thead>
            <tr>
              <th><button type="button" onClick={() => handleSort("name")}>Nombre {sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button></th>
              <th><button type="button" onClick={() => handleSort("tickets")}>Tickets {sortKey === "tickets" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button></th>
              <th><button type="button" onClick={() => handleSort("convertedTickets")}>Convertidos {sortKey === "convertedTickets" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button></th>
              <th><button type="button" onClick={() => handleSort("conversionRate")}>Efectividad {sortKey === "conversionRate" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button></th>
              <th><button type="button" onClick={() => handleSort("pipeline")}>Pipeline {sortKey === "pipeline" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button></th>
              <th><button type="button" onClick={() => handleSort("shareRate")}>Participación {sortKey === "shareRate" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button></th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.rows.map((item) => (
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
      </div>

      <PaginationControls
        page={pagedRows.page}
        totalPages={pagedRows.totalPages}
        pageSize={pageSize}
        totalItems={sortedRows.length}
        start={pagedRows.start}
        end={pagedRows.end}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />

      {sortedRows.length === 0 && <EmptyState text="Sin detalle disponible." />}
    </div>
  );
}

type RankingItem = {
  name: string;
  tickets: number;
  convertedTickets: number;
  pipeline: number;
};

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
