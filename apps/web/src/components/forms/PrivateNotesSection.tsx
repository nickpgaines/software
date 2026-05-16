"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type AttachmentKind = "image" | "file" | "audio";

export type AttachmentDraft = {
  key: string;
  kind: AttachmentKind;
  filename: string;
  mime_type: string;
  content: string;
  size: number;
};

const MAX_BYTES = 5 * 1024 * 1024;

function uid() {
  return Math.random().toString(36).slice(2);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PrivateNotesSection({
  notes,
  setNotes,
  attachments,
  setAttachments,
}: {
  notes: string;
  setNotes: (s: string) => void;
  attachments: AttachmentDraft[];
  setAttachments: (next: AttachmentDraft[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleFiles(files: FileList | null, kind: AttachmentKind) {
    if (!files) return;
    const next: AttachmentDraft[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        setRecordError(
          `${file.name} is too large (max ${formatBytes(MAX_BYTES)})`
        );
        continue;
      }
      const content = await fileToDataUrl(file);
      next.push({
        key: uid(),
        kind,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        content,
        size: file.size,
      });
    }
    if (next.length) setAttachments([...attachments, ...next]);
  }

  async function startRecording() {
    setRecordError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (blob.size > MAX_BYTES) {
          setRecordError(`Voice memo is too large (max ${formatBytes(MAX_BYTES)})`);
          setRecording(false);
          setElapsed(0);
          return;
        }
        const content = await fileToDataUrl(blob);
        const ext = (recorder.mimeType || "audio/webm").includes("mp4")
          ? "mp4"
          : "webm";
        setAttachments([
          ...attachments,
          {
            key: uid(),
            kind: "audio",
            filename: `voice-memo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`,
            mime_type: recorder.mimeType || "audio/webm",
            content,
            size: blob.size,
          },
        ]);
        setRecording(false);
        setElapsed(0);
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not start recording";
      setRecordError(`Microphone access denied: ${msg}`);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function removeAttachment(key: string) {
    setAttachments(attachments.filter((a) => a.key !== key));
  }

  return (
    <section className="bg-card border border-line rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">
          Private Notes
        </h2>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Write your note here…"
        className="w-full border-line rounded-2xl px-4 py-3 text-sm bg-card h-auto"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const files = e.target.files;
            const isImage = (f: File) => f.type.startsWith("image/");
            const hasImage = files && Array.from(files).every(isImage);
            handleFiles(files, hasImage ? "image" : "file");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          className="h-auto inline-flex items-center gap-2 border border-dashed border-line bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-zinc-200"
        >
          <AttachIcon />
          Add Attachment
        </Button>

        {recording ? (
          <Button
            type="button"
            variant="ghost"
            onClick={stopRecording}
            className="h-auto inline-flex items-center gap-2 border border-dashed border-rose-500/60 bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-rose-300"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Stop · {formatDuration(elapsed)}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={startRecording}
            className="h-auto inline-flex items-center gap-2 border border-dashed border-line bg-transparent hover:bg-black rounded-xl px-3 py-2 text-sm font-bold text-zinc-200"
          >
            <MicIcon />
            Add Voice Memo
          </Button>
        )}
      </div>

      {recordError && (
        <p className="mt-2 text-xs text-rose-400 font-bold">{recordError}</p>
      )}

      {attachments.length > 0 && (
        <ul className="mt-4 space-y-2">
          {attachments.map((a) => (
            <li
              key={a.key}
              className="border border-line rounded-xl px-3 py-2 bg-black/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 shrink-0">
                  {a.kind === "image" ? (
                    <ImageIcon />
                  ) : a.kind === "audio" ? (
                    <MicIcon />
                  ) : (
                    <FileIcon />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white tracking-tight truncate">
                    {a.filename}
                  </div>
                  <div className="text-xs text-zinc-500 font-bold">
                    {formatBytes(a.size)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove ${a.filename}`}
                  onClick={() => removeAttachment(a.key)}
                  className="h-auto p-1 text-zinc-500 hover:text-white"
                >
                  ×
                </Button>
              </div>
              {a.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.content}
                  alt={a.filename}
                  className="mt-2 max-h-40 rounded-lg border border-line"
                />
              )}
              {a.kind === "audio" && (
                <audio
                  controls
                  src={a.content}
                  className="mt-2 w-full max-w-sm"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
