"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import CustomerForm from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return <Suspense fallback={null}><NewCustomerForm /></Suspense>;
}

function NewCustomerForm() {
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
