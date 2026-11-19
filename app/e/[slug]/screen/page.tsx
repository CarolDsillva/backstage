import { StageScreen } from './StageScreen';

export default async function ScreenPage({ params }: PageProps<'/e/[slug]/screen'>) {
  const { slug } = await params;
  return <StageScreen slug={slug} />;
}
