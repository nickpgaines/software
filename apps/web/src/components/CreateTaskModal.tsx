"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";

export default function CreateTaskModal({
  open,
  onOpenChange,
  onCreated,
  defaultStartIso,
  defaultEndIso,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  /** Prefill Start/End when opened from a specific calendar slot. */
  defaultStartIso?: string;
  defaultEndIso?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <TaskForm
          variant="modal"
          active={open}
          defaultStartIso={defaultStartIso}
          defaultEndIso={defaultEndIso}
          onDone={(created) => {
            if (created) onCreated?.();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
