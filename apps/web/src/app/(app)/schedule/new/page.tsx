import { Suspense } from "react";
import JobForm from "@/components/JobForm";

export const dynamic = "force-dynamic";

export default function NewJobPage() {
  return (
    <Suspense fallback={null}>
      <JobForm mode="create" />
    </Suspense>
  );
}
