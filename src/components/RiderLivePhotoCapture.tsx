"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RiderLivePhotoCapture({ disabled = false, onCapture }: { disabled?: boolean; onCapture: (photo: Blob | null) => void }) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCamera() {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Live camera needs HTTPS or localhost and camera permission.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", height: { ideal: 960 }, width: { ideal: 720 } } });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setError("Camera access was blocked. Allow camera permission and try again.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return setError("Camera is still starting. Try again.");
    const scale = Math.min(1, 720 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setError("The photo could not be captured. Please try again.");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      onCapture(blob);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setActive(false);
    }, "image/jpeg", 0.86);
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onCapture(null);
    void startCamera();
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><Camera className="size-5" /></span>
        <div><p className="text-sm font-black">Live identity photo</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Face the camera in good light. Gallery uploads are not used.</p></div>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg bg-[#101713]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Captured rider identity" className="aspect-[4/3] w-full object-cover" src={previewUrl} />
        ) : <video className={`aspect-[4/3] w-full object-cover ${active ? "block" : "hidden"}`} muted playsInline ref={videoRef} />}
        {!previewUrl && !active ? <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-white/70"><CameraOff className="size-8" /><p className="text-sm font-bold">Camera is off</p></div> : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {previewUrl ? <><Button disabled={disabled} onClick={retake} type="button" variant="outline"><RefreshCcw className="size-4" /> Retake</Button><div className="flex h-10 items-center justify-center gap-2 rounded-md bg-secondary text-sm font-black"><Check className="size-4" /> Captured</div></> : active ? <Button className="col-span-2" disabled={disabled} onClick={capturePhoto} type="button"><Camera className="size-4" /> Capture now</Button> : <Button className="col-span-2" disabled={disabled} onClick={() => void startCamera()} type="button"><Camera className="size-4" /> Open front camera</Button>}
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
