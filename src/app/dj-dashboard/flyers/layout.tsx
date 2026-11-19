import { Suspense } from "react";
import { GuidedTour } from "@/components/admin/guided-tour";

/** The flyer pages can be part of a What's New walkthrough (it renders nothing otherwise). */
export default function FlyersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <GuidedTour />
      </Suspense>
    </>
  );
}
