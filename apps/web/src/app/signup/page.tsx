import SignupForm from "@/components/signup/SignupForm";
import {
  isForgeBillingEnabled,
} from "@/lib/forge-billing/config";
import { forgePublicAccessCopy } from "@/lib/forge-billing/copy";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const billingEnabled = isForgeBillingEnabled();
  const accessCopy = forgePublicAccessCopy(
    billingEnabled,
  );
  return <SignupForm accessCopy={accessCopy.signup} />;
}
