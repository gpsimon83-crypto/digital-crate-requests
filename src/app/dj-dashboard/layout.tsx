import { Suspense } from "react";
import { GuidedTour } from "@/components/admin/guided-tour";
import { DjShell } from "@/components/dj/dj-shell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountRole, isStaffRole } from "@/lib/roles";
import { viewAsDjId } from "@/lib/view-as";
import { DASH_LAYOUT_BOOT, SITE_THEME_BOOT } from "@/lib/site-theme-boot";

/**
 * DJ portal frame. DJs (and staff in View as DJ) get the portal menu, like
 * the admin side has; staff on their own keep these pages bare, since they
 * reach them from the admin menu. Walkthroughs can run on every DJ page.
 */
export default async function DjDashboardLayout({ children }: { children: React.ReactNode }) {
  let shell = false;
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) shell = !isStaffRole(accountRole(user)) || !!(await viewAsDjId(createAdminClient(), user));
  } catch {
    shell = false;
  }
  const tour = (
    <Suspense fallback={null}>
      <GuidedTour />
    </Suspense>
  );
  if (!shell)
    return (
      <>
        {children}
        {tour}
      </>
    );
  return (
    <>
      {/* The DJ's picked site theme and dashboard layout, before the first paint. */}
      <script dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOT + DASH_LAYOUT_BOOT }} />
      <DjShell>{children}</DjShell>
      {tour}
    </>
  );
}
