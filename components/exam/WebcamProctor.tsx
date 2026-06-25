"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, CameraOff, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Props {
  sessionId: string;
  enabled?: boolean;
  intervalSeconds?: number;
}

export default function WebcamProctor({
  sessionId,
  enabled = false,
  intervalSeconds = 120,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "active" | "denied" | "off">("idle");
  const [snapshotCount, setSnapshotCount] = useState(0);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setStatus("off");
      return;
    }
    startWebcam();
  }, [enabled, sessionId]);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("active");

      // Update session with consent
      await supabase.from("sessions").update({ webcam_consent: true }).eq("id", sessionId);

      // Start snapshot capture loop
      const interval = setInterval(() => captureSnapshot(), intervalSeconds * 1000);
      captureSnapshot(); // first snapshot immediately
      return () => clearInterval(interval);
    } catch {
      setStatus("denied");
      // Log violation
      await supabase.from("violation_logs").insert({
        session_id: sessionId,
        type: "webcam_missing",
        metadata: { reason: "user_denied" },
      });
    }
  }

  async function captureSnapshot() {
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
  }

  if (status === "off" || !enabled) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999]"
      style={{ width: 120, height: 90 }}
    >
      {/* Hidden video + canvas elements for capture */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {status === "active" && (
        <div className="rounded-xl overflow-hidden border-2"
          style={{ borderColor: "rgba(52,211,153,0.5)", background: "var(--bg-card)" }}>
          <div className="flex items-center gap-1 px-2 py-1"
            style={{ background: "rgba(52,211,153,0.15)", fontSize: 10 }}>
            <Camera size={10} style={{ color: "var(--success)" }} />
            <span style={{ color: "var(--success)" }}>Proctored · {snapshotCount} snaps</span>
          </div>
          <video
            ref={videoRef}
            className="w-full"
            muted
            playsInline
            autoPlay
            style={{ height: 68, objectFit: "cover" }}
          />
        </div>
      )}

      {status === "denied" && (
        <div className="rounded-xl p-2 text-center"
          style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)" }}>
          <CameraOff size={20} className="mx-auto mb-1" style={{ color: "var(--danger)" }} />
          <p style={{ fontSize: 9, color: "var(--danger)" }}>Camera denied — logged</p>
        </div>
      )}
    </div>
  );
}
