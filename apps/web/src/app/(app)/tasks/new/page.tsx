"use client";

import { useRouter } from "next/navigation";
import TaskForm from "@/components/TaskForm";

export default function NewTaskPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <TaskForm
        variant="page"
        active
        cancelHref="/schedule"
        onDone={(created) => {
          router.push("/schedule");
          if (created) router.refresh();
        }}
      />
    </div>
  );
}
