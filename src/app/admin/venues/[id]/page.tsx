import { VenueAdmin } from "@/components/venue/venue-admin";

export default async function AdminVenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VenueAdmin venueId={id} />;
}
