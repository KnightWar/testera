"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CameraOff } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Props {
  sessionId: string;
  enabled?: boolean;
  onStatusChange?: (status: "active" | "denied" | "off") => void;
  retryTrigger?: number;
}

export default function WebcamProctor({
  sessionId,
  enabled = false,
  onStatusChange,
  retryTrigger = 0,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "active" | "denied" | "off">("idle");
  const [snapshotCount, setSnapshotCount] = useState(0);

  const captureSnapshot = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 320, 240);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const path = `webcam/${sessionId}/${Date.now()}.jpg`;

      const { error } = await supabase.storage.from("proctor-snapshots").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

      if (!error) {
        await supabase.from("webcam_snapshots").insert({ session_id: sessionId, storage_path: path });
        setSnapshotCount((n) => n + 1);
      }
    }, "image/jpeg", 0.7);
  }, [sessionId, supabase]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setStatus("off");
      if (onStatusChange) onStatusChange("off");
      return;
    }

    let activeStream: MediaStream | null = null;
    let timeoutId: ReturnType<typeof setTimeout>;
    let isCurrent = true;

    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!isCurrent) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr: any) {
            if (playErr.name !== "AbortError") {
              console.error("Video play failed:", playErr);
            }
          }
        }

        if (isCurrent) {
          setStatus("active");
          if (onStatusChange) onStatusChange("active");

          // Update session with consent
          await supabase.from("sessions").update({ webcam_consent: true }).eq("id", sessionId);

          // Start unpredictable capture loop (random interval between 15s and 45s)
          const runRandomCapture = () => {
            if (!isCurrent) return;
            captureSnapshot();
            const nextDelay = 15000 + Math.random() * 30000;
            timeoutId = setTimeout(runRandomCapture, nextDelay);
          };

          runRandomCapture();
        }
      } catch (err: any) {
        if (!isCurrent) return;
        
        // Ignore abort errors from standard hot-reload lifecycle swaps
        if (err.name === "AbortError") return;

        console.error("Webcam initialization failed:", err);
        setStatus("denied");
        if (onStatusChange) onStatusChange("denied");
        
        // Log violation
        await supabase.from("violation_logs").insert({
          session_id: sessionId,
          type: "webcam_missing",
          metadata: { reason: err.name || "user_denied" },
        });
      }
    }

    startWebcam();

    return () => {
      isCurrent = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled, sessionId, captureSnapshot, supabase, retryTrigger]);

  if (status === "off" || !enabled) return null;

  return (
    <div
      className="fixed top-20 right-6 z-[9999] pointer-events-none"
      style={{ width: 120, height: 90 }}
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* Proctored Header Card */}
      {status === "active" && (
        <div className="rounded-t-xl overflow-hidden border-2 border-b-0 shadow-lg pointer-events-auto"
          style={{ borderColor: "rgba(52,211,153,0.5)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-1 px-2 py-1"
            style={{ background: "rgba(52,211,153,0.15)", fontSize: 10 }}>
            <Camera size={10} className="text-[#10B981]" />
            <span className="text-[#10B981] font-semibold">Proctored · {snapshotCount} snaps</span>
          </div>
        </div>
      )}

      {/* Persistent Single Video Element */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="font-sans block"
        style={status === "active" ? {
          width: "100%",
          height: 68,
          objectFit: "cover",
          borderRadius: "0 0 12px 12px",
          border: "2px solid rgba(52,211,153,0.5)",
          borderTop: "none",
          pointerEvents: "auto"
        } : {
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none"
        }}
      />

      {status === "denied" && (
        <div className="rounded-xl p-2 text-center shadow-lg pointer-events-auto"
          style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)" }}>
          <CameraOff size={20} className="mx-auto mb-1 text-[#EF4444]" />
          <p style={{ fontSize: 9, color: "#EF4444" }} className="font-semibold">Camera Blocked</p>
        </div>
      )}
    </div>
  );
}
