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

export function calculateDashboardMetrics(tickets: Record<string, string>[]) {
  const validTickets = tickets.filter(
    (ticket) => ticket["Región Mapeada"] !== "SNAP"
  );

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

  tickets
    .filter((ticket) => ticket["Región Mapeada"] !== "SNAP")
    .forEach((ticket) => {
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