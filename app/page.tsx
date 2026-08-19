import DashboardClient from "./DashboardClient";
import { getSheetsData } from "@/lib/sheets";
import {
  calculateDashboardMetrics,
  groupByExecutive,
  groupComplianceByBusinessUnit,
  groupComplianceByManager,
  groupComplianceByRegion,
} from "@/lib/calculations";

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
  );
  const complianceByManager = groupComplianceByManager(tickets, goalsConfig);
  const complianceByBusinessUnit = groupComplianceByBusinessUnit(
    tickets,
    goalsConfig
  );
  const complianceByRegion = groupComplianceByRegion(tickets, goalsConfig);

  return (
    <DashboardClient
      updatedAt={updatedAt}
      metrics={metrics}
      alertsCount={alerts.length}
      executives={executives}
      complianceByManager={complianceByManager}
      complianceByBusinessUnit={complianceByBusinessUnit}
      complianceByRegion={complianceByRegion}
    />
  );
}
