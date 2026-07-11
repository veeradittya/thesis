import { Onboarding } from "@/components/onboarding/Onboarding";

// Standalone onboarding funnel (segment → pick stocks → write a thesis → see the daily-analysis
// demo → sign up). Writes theses to the guest store that the dashboard (/) reads.
export default function OnboardPage() {
  return <Onboarding />;
}
