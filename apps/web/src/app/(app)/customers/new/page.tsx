"use client";

import { useRouter } from "next/navigation";
import CustomerForm from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  const router = useRouter();
  return (
    <CustomerForm
      variant="page"
      customer={null}
      onClose={() => router.push("/customers")}
      onSaved={(saved) => {
        router.push(`/customers/${saved.id}`);
        router.refresh();
      }}
    />
  );
}
