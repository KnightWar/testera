"use client";

export default function WatermarkOverlay({ rollNo }: { rollNo: string }) {
  if (!rollNo) return null;
  return (
    <div
      className="watermark-overlay"
      data-roll={`${rollNo} · SoCSE · TESTERA`}
      aria-hidden="true"
    />
  );
}
