import SignupForm from "@/components/signup/SignupForm";
import {
  billingCutoff,
  isForgeBillingEnabled,
} from "@/lib/forge-billing/config";
import { forgePublicAccessCopy } from "@/lib/forge-billing/copy";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const billingEnabled = isForgeBillingEnabled();
  const accessCopy = forgePublicAccessCopy(
    billingEnabled,
    billingEnabled ? billingCutoff() : "",
  );
  return <SignupForm accessCopy={accessCopy.signup} />;
}
