import LoginForm from "@/components/login/LoginForm";
import {
  isForgeBillingEnabled,
} from "@/lib/forge-billing/config";
import { forgePublicAccessCopy } from "@/lib/forge-billing/copy";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const billingEnabled = isForgeBillingEnabled();
  const accessCopy = forgePublicAccessCopy(
    billingEnabled,
  );
  return <LoginForm signupPrompt={accessCopy.login} />;
}
