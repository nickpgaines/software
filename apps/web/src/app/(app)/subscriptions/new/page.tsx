import { Suspense } from "react";
import NewSubscriptionForm from "@/components/NewSubscriptionForm";

export const dynamic = "force-dynamic";

export default function NewSubscriptionPage() {
  return (
    <Suspense>
      <NewSubscriptionForm />
    </Suspense>
  );
}
