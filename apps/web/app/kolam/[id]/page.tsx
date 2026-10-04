import { PondDashboard } from "@/components/pond-dashboard";

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PondDashboard key={id} params={params} audience />;
}
