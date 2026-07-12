import { Suspense } from "react";
import { Onboarding } from "@/components/onboarding/Onboarding";

// Standalone onboarding funnel (segment → pick stocks → write a thesis → see the daily-verdict
// demo → sign up). Also the FIRST-VISIT LANDING PAGE (the dashboard redirects new visitors
// here). "?add=1" (dashboard's New-thesis card) skips the questionnaire straight to picking —
// hence the Suspense boundary useSearchParams requires under static prerendering.
export default function OnboardPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
