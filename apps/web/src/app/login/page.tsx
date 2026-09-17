import LoginForm from "@/components/login/LoginForm";
import {
  billingCutoff,
  isForgeBillingEnabled,
} from "@/lib/forge-billing/config";
import { forgePublicAccessCopy } from "@/lib/forge-billing/copy";

export default function LoginPage() {
  const billingEnabled = isForgeBillingEnabled();
  const accessCopy = forgePublicAccessCopy(
    billingEnabled,
    billingEnabled ? billingCutoff() : "",
  );
  return <LoginForm signupPrompt={accessCopy.login} />;
}
