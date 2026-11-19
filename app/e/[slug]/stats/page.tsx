import { StatsView } from './StatsView';

export default async function StatsPage({ params }: PageProps<'/e/[slug]/stats'>) {
  const { slug } = await params;
  return <StatsView slug={slug} />;
}
