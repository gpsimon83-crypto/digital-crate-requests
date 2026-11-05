import { EmailStudio } from "@/components/comm/email-studio";

export default async function EmailStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailStudio designId={id} />;
}
