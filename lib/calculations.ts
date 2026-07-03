function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/\$/g, "")
    .replace(/US\$/g, "")
    .replace(/USD/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTrue(value: unknown): boolean {
  const text = String(value).toUpperCase().trim();
  return text === "TRUE" || text === "VERDADERO" || text === "SI" || text === "SÍ";
}

function getPipelineAmount(ticket: Record<string, string>): number {
  return toNumber(
    ticket["Pipeline Asociado"] ||
      ticket["Pipeline asociado"] ||
      ticket["pipeline asociado"] ||
      ticket["Deal Amount"] ||
      ticket["Amount"] ||
      0
  );
}

function getConversionRate(converted: number, total: number): number {
  return total > 0 ? Math.round((converted / total) * 100) : 0;
}

function getComplianceRate(actual: number, target: number): number {
  return target > 0 ? Math.round((actual / target) * 100) : 0;
}

function getField(row: Record<string, string>, possibleNames: string[]) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== "") {
      return row[name];
    }
  }

  return "";
}

function normalizeTeam(value: string) {
  const text = String(value).toUpperCase().trim();

  if (text.includes("TAM") || text.includes("FINOPS")) return "TAM - FINOPS";
  if (text.includes("COM")) return "COM";
  if (text.includes("CPSM")) return "CPSM";

  return value || "No mapeado";
}

function shouldIncludeRow(row: Record<string, string>) {
  const region =
    row["Región Mapeada"] ||
    row["Región"] ||
    row["Region"] ||
    "";

  const included =
    row["En meta"] ||
    row["Incluido en meta"] ||
    "TRUE";

  return region !== "SNAP" && isTrue(included);
}

export function calculateDashboardMetrics(tickets: Record<string, string>[]) {
  const validTickets = tickets.filter(shouldIncludeRow);

  const totalTickets = validTickets.length;

  const converted = validTickets.filter((ticket) =>
    isTrue(ticket["Convertido"])
  ).length;

  const expiring = validTickets.filter(
    (ticket) => ticket["Estado SLA"] === "Por expirar"
  ).length;

  const expired = validTickets.filter(
    (ticket) => ticket["Estado SLA"] === "Expirado"
  ).length;

  const pending = validTickets.filter(
    (ticket) =>
      ticket["Estado SLA"] === "En tiempo" ||
      ticket["Estado SLA"] === "Por expirar"
  ).length;

  const pipeline = validTickets.reduce((sum, ticket) => {
    return sum + getPipelineAmount(ticket);
  }, 0);

  const conversionRate = getConversionRate(converted, totalTickets);

  return {
    totalTickets,
    converted,
    expiring,
    expired,
    pending,
    pipeline,
    conversionRate,
  };
}

export function groupByExecutive(tickets: Record<string, string>[]) {
  const map = new Map<
    string,
    {
      executive: string;
      team: string;
      region: string;
      businessUnit: string;
      tickets: number;
      converted: number;
      expired: number;
      expiring: number;
      pipeline: number;
      conversionRate: number;
    }
  >();

  tickets.filter(shouldIncludeRow).forEach((ticket) => {
    const executive = ticket["Ejecutivo"] || "No mapeado";

    if (!map.has(executive)) {
      map.set(executive, {
        executive,
        team: ticket["Equipo"] || "",
        region: ticket["Región Mapeada"] || "",
        businessUnit: ticket["Unidad de Negocio Mapeada"] || "",
        tickets: 0,
        converted: 0,
        expired: 0,
        expiring: 0,
        pipeline: 0,
        conversionRate: 0,
      });
    }

    const row = map.get(executive)!;

    row.tickets += 1;

    if (isTrue(ticket["Convertido"])) {
      row.converted += 1;
    }

    if (ticket["Estado SLA"] === "Expirado") {
      row.expired += 1;
    }

    if (ticket["Estado SLA"] === "Por expirar") {
      row.expiring += 1;
    }

    row.pipeline += getPipelineAmount(ticket);
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      conversionRate: getConversionRate(row.converted, row.tickets),
    }))
    .sort((a, b) => {
      if (b.pipeline !== a.pipeline) return b.pipeline - a.pipeline;
      return b.tickets - a.tickets;
    });
}

export function groupComplianceByManager(
  tickets: Record<string, string>[],
  teamMapping: Record<string, string>[]
) {
  const actuals = new Map<string, number>();
  const targets = new Map<string, number>();

  tickets.filter(shouldIncludeRow).forEach((ticket) => {
    const team = normalizeTeam(ticket["Equipo"] || ticket["Gestionado por"] || "");
    actuals.set(team, (actuals.get(team) || 0) + 1);
  });

  teamMapping
    .filter((row) => {
      const active = getField(row, ["Activo", "active"]);
      const included = getField(row, ["Incluido en meta", "En meta"]);
      const region = getField(row, ["Región", "Region"]);

      return region !== "SNAP" && isTrue(active || "TRUE") && isTrue(included || "TRUE");
    })
    .forEach((row) => {
      const team = normalizeTeam(getField(row, ["Equipo", "Gestionado por"]));
      const target = toNumber(
        getField(row, [
          "Meta esperada a la fecha",
          "Meta Esperada a la Fecha",
          "Meta esperada",
          "Meta a la fecha",
        ])
      );

      targets.set(team, (targets.get(team) || 0) + target);
    });

  const names = Array.from(new Set([...actuals.keys(), ...targets.keys()])).filter(
    (name) => name && name !== "No mapeado"
  );

  return names
    .map((name) => {
      const actual = actuals.get(name) || 0;
      const target = targets.get(name) || 0;

      return {
        name,
        actual,
        target,
        complianceRate: getComplianceRate(actual, target),
      };
    })
    .sort((a, b) => b.complianceRate - a.complianceRate);
}

export function groupComplianceByBusinessUnit(
  tickets: Record<string, string>[],
  teamMapping: Record<string, string>[]
) {
  const actuals = new Map<string, number>();
  const targets = new Map<string, number>();

  tickets.filter(shouldIncludeRow).forEach((ticket) => {
    const businessUnit =
      ticket["Unidad de Negocio Mapeada"] ||
      ticket["Unidad de Negocio"] ||
      "No mapeado";

    actuals.set(businessUnit, (actuals.get(businessUnit) || 0) + 1);
  });

  teamMapping
    .filter((row) => {
      const active = getField(row, ["Activo", "active"]);
      const included = getField(row, ["Incluido en meta", "En meta"]);
      const region = getField(row, ["Región", "Region"]);

      return region !== "SNAP" && isTrue(active || "TRUE") && isTrue(included || "TRUE");
    })
    .forEach((row) => {
      const businessUnit = getField(row, [
        "Unidad de Negocio",
        "Unidad de Negocio Mapeada",
        "Unidad de negocio",
      ]);

      const target = toNumber(
        getField(row, [
          "Meta esperada a la fecha",
          "Meta Esperada a la Fecha",
          "Meta esperada",
          "Meta a la fecha",
        ])
      );

      if (businessUnit) {
        targets.set(businessUnit, (targets.get(businessUnit) || 0) + target);
      }
    });

  const names = Array.from(new Set([...actuals.keys(), ...targets.keys()])).filter(
    (name) => name && name !== "No mapeado"
  );

  return names
    .map((name) => {
      const actual = actuals.get(name) || 0;
      const target = targets.get(name) || 0;

      return {
        name,
        actual,
        target,
        complianceRate: getComplianceRate(actual, target),
      };
    })
    .sort((a, b) => b.complianceRate - a.complianceRate);
}