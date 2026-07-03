export type SheetsPayload = {
  updatedAt: string;
  data: {
    Tickets_Processed?: Record<string, string>[];
    Team_Mapping?: Record<string, string>[];
    Goals_Config?: Record<string, string>[];
    Alertas_Activas?: Record<string, string>[];
    Dashboard?: Record<string, string>[];
  };
};

export async function getSheetsData(): Promise<SheetsPayload> {
  const baseUrl = process.env.SHEETS_WEBAPP_URL;
  const token = process.env.SHEETS_WEBAPP_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Missing Sheets Web App configuration");
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  const requestUrl = `${baseUrl}${separator}token=${encodeURIComponent(
    token
  )}&ts=${Date.now()}`;

  const response = await fetch(requestUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google Sheets data");
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
}