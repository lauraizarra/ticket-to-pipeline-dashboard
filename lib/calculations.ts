function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;

  let cleaned = String(value)
    .replace(/US\$/gi, "")
    .replace(/USD/gi, "")
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");

    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const commaParts = cleaned.split(",");

    if (commaParts.length === 2 && commaParts[1].length <= 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasDot && !hasComma) {
    const dotParts = cleaned.split(".");

    if (dotParts.length > 2) {
      cleaned = cleaned.replace(/\./g, "");
    } else if (dotParts.length === 2 && dotParts[1].length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTrue(value: unknown): boolean {
  const text = normalizeText(value);

  return (
    text === "TRUE" ||
    text === "VERDADERO" ||
    text === "SI" ||
    text === "YES" ||
    text === "1" ||
    text === "Y"
  );
}

function getField(row: Record<string, string>, possibleNames: string[]) {
  const entries = Object.entries(row).map(([key, value]) => ({
    normalizedKey: normalizeText(key),
    compactKey: normalizeText(key).replace(/[^A-Z0-9]/g, ""),
    value,
  }));

  for (const name of possibleNames) {
    if (row[name] !== undefined && String(row[name]).trim() !== "") {
      return row[name];
    }

    const normalizedName = normalizeText(name);
    const compactName = normalizedName.replace(/[^A-Z0-9]/g, "");

    const exactMatch = entries.find(
      (entry) =>
        entry.normalizedKey === normalizedName &&
        String(entry.value || "").trim() !== ""
    );

    if (exactMatch) return exactMatch.value;

    const compactMatch = entries.find(
      (entry) =>
        entry.compactKey === compactName &&
        String(entry.value || "").trim() !== ""
    );

    if (compactMatch) return compactMatch.value;
  }

  return "";
}

function getPipelineAmount(ticket: Record<string, string>): number {
  return toNumber(
    getField(ticket, [
      "Pipeline Asociado",
      "Pipeline asociado",
      "Pipeline",
      "Associated Pipeline",
      "Pipeline asociado USD",
      "Deal Amount",
      "Amount",
      "Monto",
      "Valor del negocio",
      "Net Revenue",
      "NR",
      "Pipeline Amount",
    ])
  );
}

function getConversionRate(converted: number, total: number): number {
  return total > 0 ? Math.round((converted / total) * 100) : 0;
}

function getComplianceRate(actual: number, target: number): number {
  return target > 0 ? Math.round((actual / target) * 100) : 0;
}

function getShareRate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function normalizeTeam(value: string) {
  const text = normalizeText(value);

  if (text.includes("TAM") || text.includes("FINOPS")) return "TAM - FINOPS";
  if (text.includes("COM")) return "COM";
  if (text.includes("CPSM")) return "CPSM";

  return value || "No mapeado";
}

function normalizeRegionName(region: string) {
  const normalized = normalizeText(region);

  if (normalized.includes("MEX") || normalized === "MX") return "MX";
  if (normalized.includes("CARIBE")) return "CARIBE";
  if (normalized.includes("NOLA")) return "NOLA";
  if (normalized.includes("SOLA")) return "SOLA";
  if (normalized.includes("SNAP")) return "SNAP";

  return region || "Sin región";
}

function getRegion(row: Record<string, string>) {
  return normalizeRegionName(
    getField(row, ["Región Mapeada", "Región", "Region"])
  );
}

function getTeam(row: Record<string, string>) {
  return getField(row, ["Equipo", "Gestionado por", "Team"]) || "Sin equipo";
}

function getBusinessUnit(row: Record<string, string>) {
  return (
    getField(row, [
      "Unidad de Negocio Mapeada",
      "Unidad de Negocio",
      "Unidad de negocio",
      "Business Unit",
      "BU",
      "Unidad",
    ]) || "No mapeado"
  );
}

function shouldIncludeRow(row: Record<string, string>) {
  const region = getRegion(row);

  const included = getField(row, [
    "En meta",
    "Incluido en meta",
    "Incluido",
    "Included",
  ]);

  return region !== "SNAP" && isTrue(included || "TRUE");
}

function getExecutiveName(row: Record<string, string>) {
  return (
    getField(row, [
      "Ejecutivo",
      "Nombre completo",
      "Executive",
      "Owner",
      "Responsable",
      "Ticket Owner",
      "Propietario",
      "Propietario del Ticket",
      "Propietario del ticket",
      "Owner Name",
      "Owner name",
      "Nombre ejecutivo",
      "Executive Name",
      "Name",
      "Nombre",
    ]) || "No mapeado"
  );
}

function isConverted(ticket: Record<string, string>) {
  const status = normalizeText(
    getField(ticket, [
      "Estado del ticket",
      "Estado",
      "Ticket Status",
      "Status",
      "Estado ticket",
      "Estado General",
    ])
  );

  const convertedFlag = getField(ticket, [
    "Convertido",
    "Converted",
    "Is Converted",
    "Ticket convertido",
  ]);

  return isTrue(convertedFlag) || status.includes("CONVERT");
}

function isDiscarded(ticket: Record<string, string>) {
  const status = normalizeText(
    getField(ticket, [
      "Estado del ticket",
      "Estado",
      "Ticket Status",
      "Status",
      "Estado ticket",
      "Estado General",
    ])
  );

  const discardedFlag = getField(ticket, [
    "Descartado",
    "Discarded",
    "Is Discarded",
    "Ticket descartado",
  ]);

  return (
    isTrue(discardedFlag) ||
    status.includes("DESCART") ||
    status.includes("CANCEL") ||
    status.includes("CERRADO SIN") ||
    status.includes("CLOSED LOST") ||
    status.includes("NO AVANZA")
  );
}

function isExpired(ticket: Record<string, string>) {
  const sla = normalizeText(getField(ticket, ["Estado SLA", "SLA Status"]));
  const alert = normalizeText(
    getField(ticket, [
      "Tipo alerta",
      "Tipo de alerta",
      "Alert Type",
      "Alerta activa",
    ])
  );

  return (
    sla === "EXPIRADO" ||
    sla.includes("EXPIRADO") ||
    alert.includes("EXPIR") ||
    alert.includes("5+") ||
    alert.includes("ALERTA")
  );
}

function isExpiring(ticket: Record<string, string>) {
  const sla = normalizeText(getField(ticket, ["Estado SLA", "SLA Status"]));
  const alert = normalizeText(
    getField(ticket, ["Tipo alerta", "Tipo de alerta", "Alert Type"])
  );

  return (
    sla.includes("POR EXPIRAR") ||
    alert.includes("3/4") ||
    alert.includes("POR EXPIRAR")
  );
}

function getTicketBucket(ticket: Record<string, string>) {
  if (isConverted(ticket)) return "converted";
  if (isDiscarded(ticket)) return "discarded";
  if (isExpired(ticket)) return "expired";
  return "waiting";
}

function getGoalRows(goalsConfig: Record<string, string>[]) {
  return goalsConfig.filter((row) => {
    const type = normalizeText(getField(row, ["Tipo", "Type"]));
    return type === "REGION" || type === "";
  });
}

function getGoalTargetTickets(row: Record<string, string>) {
  return toNumber(
    getField(row, [
      "Meta prorrateada tickets",
      "Meta prorrateada HC tickets",
      "Meta restante",
      "Target tickets",
      "Tickets target",
    ])
  );
}

function getGoalTargetPipeline(row: Record<string, string>) {
  return toNumber(
    getField(row, [
      "Valor prorrateado pipeline",
      "Pipeline prorrateado",
      "Meta pipeline prorrateada",
      "Valor restante",
      "Pipeline target",
    ])
  );
}

function getGoalHc(row: Record<string, string>) {
  return toNumber(
    getField(row, [
      "HC",
      "HC incluido",
      "Headcount",
      "Cantidad HC",
      "Cantidad",
    ])
  );
}

function getGoalIndividualTargetTickets(row: Record<string, string>) {
  const directValue = toNumber(
    getField(row, [
      "Meta Individual Prorrateada",
      "Meta individual prorrateada",
      "Meta individual",
      "Meta prorrateada individual",
      "Individual target tickets",
    ])
  );

  if (directValue > 0) return directValue;

  const targetTickets = getGoalTargetTickets(row);
  const hc = getGoalHc(row);

  if (targetTickets > 0 && hc > 0) {
    return targetTickets / hc;
  }

  return 0;
}

function getExecutiveTargetFromGoals(
  region: string,
  team: string,
  goalsConfig: Record<string, string>[]
) {
  const normalizedRegion = normalizeRegionName(region);
  const normalizedTeam = normalizeTeam(team);

  const matchingGoal = getGoalRows(goalsConfig).find((row) => {
    const goalRegion = normalizeRegionName(getField(row, ["Región", "Region"]));
    const goalTeam = normalizeTeam(
      getField(row, ["Equipo", "Team", "Rol", "Role"])
    );

    return goalRegion === normalizedRegion && goalTeam === normalizedTeam;
  });

  if (!matchingGoal) return 0;

  return getGoalIndividualTargetTickets(matchingGoal);
}

function getExecutiveTargetFromMapping(
  executive: string,
  teamMapping: Record<string, string>[] = [],
  dashboardRows: Record<string, string>[] = []
) {
  const normalizedExecutive = normalizeText(executive);
  const sourceRows = [...teamMapping, ...dashboardRows];

  const matchingRows = sourceRows.filter((row) => {
    const rowExecutive = normalizeText(
      getField(row, [
        "Ejecutivo",
        "Nombre completo",
        "Executive",
        "Owner",
        "Responsable",
        "Ticket Owner",
        "Propietario",
        "Propietario del Ticket",
        "Propietario del ticket",
        "Owner Name",
        "Owner name",
        "Nombre",
        "Name",
        "Nombre ejecutivo",
        "Executive Name",
      ])
    );

    const active = getField(row, ["Activo", "active"]);
    const included = getField(row, ["Incluido en meta", "En meta", "Included"]);
    const region = normalizeRegionName(
      getField(row, ["Región", "Region", "Región Mapeada"])
    );

    return (
      rowExecutive === normalizedExecutive &&
      region !== "SNAP" &&
      isTrue(active || "TRUE") &&
      isTrue(included || "TRUE")
    );
  });

  return matchingRows.reduce((sum, row) => {
    const target = toNumber(
      getField(row, [
        "Meta esperada a la fecha",
        "Meta Esperada a la Fecha",
        "Meta esperada",
        "Meta a la fecha",
        "Meta 6M",
        "Meta 6 meses",
        "Meta semestral",
        "Meta Semestral",
        "Meta prorrateada",
        "Meta prorrateada 6M",
        "Meta restante",
        "Meta anual",
        "Meta",
        "Goal",
        "Target 6M",
        "Target",
        "Objetivo",
      ])
    );

    return sum + target;
  }, 0);
}

function getExecutiveTarget(
  executive: string,
  region: string,
  team: string,
  goalsConfig: Record<string, string>[] = [],
  teamMapping: Record<string, string>[] = [],
  dashboardRows: Record<string, string>[] = []
) {
  const targetFromGoals = getExecutiveTargetFromGoals(region, team, goalsConfig);

  if (targetFromGoals > 0) {
    return targetFromGoals;
  }

  const targetFromMapping = getExecutiveTargetFromMapping(
    executive,
    teamMapping,
    dashboardRows
  );

  if (targetFromMapping > 0) {
    return targetFromMapping;
  }

  return 12;
}

function buildGoalTargets(
  goalsConfig: Record<string, string>[],
  dimension: "region" | "team"
) {
  const targets = new Map<
    string,
    {
      targetTickets: number;
      targetPipeline: number;
    }
  >();

  getGoalRows(goalsConfig).forEach((row) => {
    const key =
      dimension === "region"
        ? normalizeRegionName(getField(row, ["Región", "Region"]))
        : normalizeTeam(getField(row, ["Equipo", "Team", "Rol", "Role"]));

    if (
      !key ||
      key === "SNAP" ||
      key === "Sin región" ||
      key === "Sin equipo" ||
      key === "No mapeado"
    ) {
      return;
    }

    const targetTickets = getGoalTargetTickets(row);
    const targetPipeline = getGoalTargetPipeline(row);

    if (!targets.has(key)) {
      targets.set(key, {
        targetTickets: 0,
        targetPipeline: 0,
      });
    }

    const target = targets.get(key)!;
    target.targetTickets += targetTickets;
    target.targetPipeline += targetPipeline;
  });

  return targets;
}

export type TicketDetail = {
  id: string;
  name: string;
  company: string;
  description: string;
  executive: string;
  team: string;
  region: string;
  businessUnit: string;
  slaStatus: string;
  days: string;
  pipeline: number;
  url: string;
  status: "converted" | "waiting" | "expired" | "discarded";
};

export type ExecutivePerformance = {
  executive: string;
  team: string;
  region: string;
  businessUnit: string;
  tickets: number;
  converted: number;
  waiting: number;
  expired: number;
  expiring: number;
  discarded: number;
  pipeline: number;
  target6M: number;
  conversionRate: number;
  complianceRate: number;
  details: {
    converted: TicketDetail[];
    waiting: TicketDetail[];
    expired: TicketDetail[];
    discarded: TicketDetail[];
  };
};

export type TargetBreakdown = {
  name: string;
  tickets: number;
  convertedTickets: number;
  conversionRate: number;
  pipeline: number;
  shareRate: number;
};

export type TargetCompliance = {
  name: string;
  actualTickets: number;
  convertedTickets: number;
  targetTickets: number;
  ticketComplianceRate: number;
  conversionRate: number;
  actualPipeline: number;
  targetPipeline: number;
  pipelineComplianceRate: number;
  breakdown: TargetBreakdown[];
};

function buildTicketDetail(ticket: Record<string, string>): TicketDetail {
  return {
    id: getField(ticket, [
      "Ticket ID",
      "ID Ticket",
      "Record ID",
      "ID",
      "hs_object_id",
      "HS Object ID",
    ]),
    name:
      getField(ticket, [
        "Nombre del ticket",
        "Ticket",
        "Ticket Name",
        "Asunto",
        "Subject",
        "Name",
        "Nombre",
      ]) || "Ticket sin nombre",
    company:
      getField(ticket, [
        "Empresa",
        "Empresa asociada",
        "Nombre de empresa",
        "Nombre de la empresa",
        "Compañía",
        "Compania",
        "Company",
        "Company Name",
        "Associated Company",
        "Associated company",
        "Cuenta",
        "Account",
        "Cliente",
        "Client",
        "Company associated",
      ]) || "Sin empresa",
    description: getField(ticket, [
      "Descripción del Ticket",
      "Descripción del ticket",
      "Descripcion del Ticket",
      "Descripcion del ticket",
      "Descripción Ticket",
      "Descripcion Ticket",
      "Descripción",
      "Descripcion",
      "Ticket Description",
      "Ticket description",
      "Description",
      "description",
      "Contenido",
      "Content",
      "Detalle",
      "Detalle del ticket",
      "Resumen",
      "Notas",
      "Notes",
      "Body",
      "Mensaje",
      "Message",
      "Texto",
      "Ticket Body",
    ]),
    executive: getExecutiveName(ticket),
    team: getTeam(ticket),
    region: getRegion(ticket),
    businessUnit: getBusinessUnit(ticket),
    slaStatus: getField(ticket, ["Estado SLA", "SLA Status"]) || "Sin SLA",
    days: getField(ticket, [
      "Días desde creación",
      "Días",
      "Dias",
      "Days",
      "Días abierto",
      "Dias abierto",
      "Days Open",
    ]),
    pipeline: getPipelineAmount(ticket),
    url: getField(ticket, [
      "Link HubSpot",
      "Ticket URL",
      "URL Ticket",
      "HubSpot URL",
      "URL",
    ]),
    status: getTicketBucket(ticket),
  };
}

export function calculateDashboardMetrics(tickets: Record<string, string>[]) {
  const validTickets = tickets.filter(shouldIncludeRow);

  const totalTickets = validTickets.length;
  const converted = validTickets.filter(isConverted).length;
  const discarded = validTickets.filter(isDiscarded).length;
  const expiring = validTickets.filter(isExpiring).length;
  const expired = validTickets.filter(isExpired).length;

  const pending = validTickets.filter(
    (ticket) => !isConverted(ticket) && !isDiscarded(ticket)
  ).length;

  const pipeline = validTickets.reduce((sum, ticket) => {
    return sum + getPipelineAmount(ticket);
  }, 0);

  const conversionRate = getConversionRate(converted, totalTickets);

  return {
    totalTickets,
    converted,
    discarded,
    expiring,
    expired,
    pending,
    pipeline,
    conversionRate,
  };
}

export function groupByExecutive(
  tickets: Record<string, string>[],
  teamMapping: Record<string, string>[] = [],
  goalsConfig: Record<string, string>[] = [],
  dashboardRows: Record<string, string>[] = []
): ExecutivePerformance[] {
  const map = new Map<string, ExecutivePerformance>();

  tickets.filter(shouldIncludeRow).forEach((ticket) => {
    const executive = getExecutiveName(ticket);
    const region = getRegion(ticket);
    const team = getTeam(ticket);

    if (!map.has(executive)) {
      map.set(executive, {
        executive,
        team,
        region,
        businessUnit: getBusinessUnit(ticket),
        tickets: 0,
        converted: 0,
        waiting: 0,
        expired: 0,
        expiring: 0,
        discarded: 0,
        pipeline: 0,
        target6M: getExecutiveTarget(
          executive,
          region,
          team,
          goalsConfig,
          teamMapping,
          dashboardRows
        ),
        conversionRate: 0,
        complianceRate: 0,
        details: {
          converted: [],
          waiting: [],
          expired: [],
          discarded: [],
        },
      });
    }

    const row = map.get(executive)!;
    const detail = buildTicketDetail(ticket);

    row.tickets += 1;
    row.pipeline += getPipelineAmount(ticket);

    if (isExpiring(ticket)) {
      row.expiring += 1;
    }

    if (detail.status === "converted") {
      row.converted += 1;
      row.details.converted.push(detail);
    } else if (detail.status === "discarded") {
      row.discarded += 1;
      row.details.discarded.push(detail);
    } else if (detail.status === "expired") {
      row.expired += 1;
      row.details.expired.push(detail);
    } else {
      row.waiting += 1;
      row.details.waiting.push(detail);
    }
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      conversionRate: getConversionRate(row.converted, row.tickets),
      complianceRate: getComplianceRate(row.tickets, row.target6M),
    }))
    .sort((a, b) => {
      if (b.pipeline !== a.pipeline) return b.pipeline - a.pipeline;
      return b.tickets - a.tickets;
    });
}

export function groupComplianceByManager(
  tickets: Record<string, string>[],
  goalsConfig: Record<string, string>[]
): TargetCompliance[] {
  const actuals = new Map<
    string,
    {
      actualTickets: number;
      convertedTickets: number;
      actualPipeline: number;
      contributors: Map<
        string,
        {
          tickets: number;
          convertedTickets: number;
          pipeline: number;
        }
      >;
    }
  >();

  tickets.filter(shouldIncludeRow).forEach((ticket) => {
    const team = normalizeTeam(getTeam(ticket));
    const executive = getExecutiveName(ticket);

    if (!team || team === "No mapeado" || team === "Sin equipo") return;

    if (!actuals.has(team)) {
      actuals.set(team, {
        actualTickets: 0,
        convertedTickets: 0,
        actualPipeline: 0,
        contributors: new Map(),
      });
    }

    const teamRow = actuals.get(team)!;
    const pipeline = getPipelineAmount(ticket);
    const converted = isConverted(ticket);

    teamRow.actualTickets += 1;
    teamRow.actualPipeline += pipeline;

    if (converted) {
      teamRow.convertedTickets += 1;
    }

    if (!teamRow.contributors.has(executive)) {
      teamRow.contributors.set(executive, {
        tickets: 0,
        convertedTickets: 0,
        pipeline: 0,
      });
    }

    const contributor = teamRow.contributors.get(executive)!;
    contributor.tickets += 1;
    contributor.pipeline += pipeline;

    if (converted) {
      contributor.convertedTickets += 1;
    }
  });

  const targets = buildGoalTargets(goalsConfig, "team");
  const preferredOrder = ["TAM - FINOPS", "CPSM", "COM"];

  const names = Array.from(
    new Set([...preferredOrder, ...actuals.keys(), ...targets.keys()])
  ).filter((name) => targets.has(name) || actuals.has(name));

  return names.map((name) => {
    const actual = actuals.get(name) || {
      actualTickets: 0,
      convertedTickets: 0,
      actualPipeline: 0,
      contributors: new Map(),
    };

    const target = targets.get(name) || {
      targetTickets: 0,
      targetPipeline: 0,
    };

    const breakdown = Array.from(actual.contributors.entries())
      .map(([contributorName, contributor]) => ({
        name: contributorName,
        tickets: contributor.tickets,
        convertedTickets: contributor.convertedTickets,
        conversionRate: getConversionRate(
          contributor.convertedTickets,
          contributor.tickets
        ),
        pipeline: contributor.pipeline,
        shareRate: getShareRate(contributor.tickets, actual.actualTickets),
      }))
      .sort((a, b) => {
        if (b.tickets !== a.tickets) return b.tickets - a.tickets;
        return b.pipeline - a.pipeline;
      });

    return {
      name,
      actualTickets: actual.actualTickets,
      convertedTickets: actual.convertedTickets,
      targetTickets: target.targetTickets,
      ticketComplianceRate: getComplianceRate(
        actual.actualTickets,
        target.targetTickets
      ),
      conversionRate: getConversionRate(
        actual.convertedTickets,
        actual.actualTickets
      ),
      actualPipeline: actual.actualPipeline,
      targetPipeline: target.targetPipeline,
      pipelineComplianceRate: getComplianceRate(
        actual.actualPipeline,
        target.targetPipeline
      ),
      breakdown,
    };
  });
}

export function groupComplianceByRegion(
  tickets: Record<string, string>[],
  goalsConfig: Record<string, string>[]
): TargetCompliance[] {
  const actuals = new Map<
    string,
    {
      actualTickets: number;
      convertedTickets: number;
      actualPipeline: number;
      businessUnits: Map<
        string,
        {
          tickets: number;
          convertedTickets: number;
          pipeline: number;
        }
      >;
    }
  >();

  tickets.filter(shouldIncludeRow).forEach((ticket) => {
    const region = getRegion(ticket);
    const businessUnit = getBusinessUnit(ticket);

    if (!region || region === "Sin región" || region === "SNAP") return;

    if (!actuals.has(region)) {
      actuals.set(region, {
        actualTickets: 0,
        convertedTickets: 0,
        actualPipeline: 0,
        businessUnits: new Map(),
      });
    }

    const regionRow = actuals.get(region)!;
    const pipeline = getPipelineAmount(ticket);
    const converted = isConverted(ticket);

    regionRow.actualTickets += 1;
    regionRow.actualPipeline += pipeline;

    if (converted) {
      regionRow.convertedTickets += 1;
    }

    if (!regionRow.businessUnits.has(businessUnit)) {
      regionRow.businessUnits.set(businessUnit, {
        tickets: 0,
        convertedTickets: 0,
        pipeline: 0,
      });
    }

    const unit = regionRow.businessUnits.get(businessUnit)!;
    unit.tickets += 1;
    unit.pipeline += pipeline;

    if (converted) {
      unit.convertedTickets += 1;
    }
  });

  const targets = buildGoalTargets(goalsConfig, "region");
  const preferredOrder = ["SOLA", "NOLA", "CARIBE", "MX"];

  const names = Array.from(
    new Set([...preferredOrder, ...actuals.keys(), ...targets.keys()])
  ).filter((name) => targets.has(name) || actuals.has(name));

  return names.map((name) => {
    const actual = actuals.get(name) || {
      actualTickets: 0,
      convertedTickets: 0,
      actualPipeline: 0,
      businessUnits: new Map(),
    };

    const target = targets.get(name) || {
      targetTickets: 0,
      targetPipeline: 0,
    };

    const breakdown = Array.from(actual.businessUnits.entries())
      .map(([unitName, unit]) => ({
        name: unitName,
        tickets: unit.tickets,
        convertedTickets: unit.convertedTickets,
        conversionRate: getConversionRate(unit.convertedTickets, unit.tickets),
        pipeline: unit.pipeline,
        shareRate: getShareRate(unit.pipeline, actual.actualPipeline),
      }))
      .sort((a, b) => {
        if (b.pipeline !== a.pipeline) return b.pipeline - a.pipeline;
        return b.tickets - a.tickets;
      });

    return {
      name,
      actualTickets: actual.actualTickets,
      convertedTickets: actual.convertedTickets,
      targetTickets: target.targetTickets,
      ticketComplianceRate: getComplianceRate(
        actual.actualTickets,
        target.targetTickets
      ),
      conversionRate: getConversionRate(
        actual.convertedTickets,
        actual.actualTickets
      ),
      actualPipeline: actual.actualPipeline,
      targetPipeline: target.targetPipeline,
      pipelineComplianceRate: getComplianceRate(
        actual.actualPipeline,
        target.targetPipeline
      ),
      breakdown,
    };
  });
}