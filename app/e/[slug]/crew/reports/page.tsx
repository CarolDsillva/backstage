import { CrewConsole } from './CrewConsole';

/** Audience help reports (the original crew console), linked from the crew HQ. */
export default async function ReportsPage({ params }: PageProps<'/e/[slug]/crew/reports'>) {
  const { slug } = await params;
  return <CrewConsole slug={slug} />;
}
