import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
} from "lucide-react";
import { API_URL } from "../config";
import { ActivityLog, ProctoringEventType } from "../types/codeclass";

interface ProctoringMonitorProps {
  sessionCode: string;
  studentId: string;
  studentName: string;
  enabled: boolean;
  inactivityThresholdSec?: number;
  onAlertToast?: (msg: string, type?: "info" | "success" | "warning") => void;
  registerPasteHandler?: (fn: (chars: number) => void) => void;
}

interface FaceAnalysisResult {
  faceCount: number;
  headPose: "Centered" | "Looking Left" | "Looking Right" | "Looking Up/Down" | "Absent";
}

// Pure TypeScript Canvas skin-region & symmetry analyzer (runs locally with zero external CDN dependencies)
function analyzeFrameFallback(ctx: CanvasRenderingContext2D, width: number, height: number): FaceAnalysisResult {
  const img = ctx.getImageData(0, 0, width, height).data;
  const gridW = width;
  const gridH = height;
  const mask = new Uint8Array(gridW * gridH);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = (y * gridW + x) * 4;
      const r = img[idx];
      const g = img[idx + 1];
      const b = img[idx + 2];

      // Standard YCbCr-inspired RGB skin-tone heuristic
      const isSkin =
        r > 75 &&
        g > 40 &&
        b > 20 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 12 &&
        Math.abs(r - g) > 10 &&
        r > g &&
        r > b;

      if (isSkin) {
        mask[y * gridW + x] = 1;
      }
    }
  }

  // Connected-component clustering to detect distinct face-sized blobs
  const visited = new Uint8Array(gridW * gridH);
  const clusters: { count: number; sumX: number; sumY: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  const stack: number[] = [];

  for (let i = 0; i < gridW * gridH; i++) {
    if (mask[i] === 1 && visited[i] === 0) {
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = gridW, maxX = 0, minY = gridH, maxY = 0;

      stack.push(i);
      visited[i] = 1;

      while (stack.length > 0) {
        const curr = stack.pop()!;
        const cx = curr % gridW;
        const cy = Math.floor(curr / gridW);
        count++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [curr - 1, curr + 1, curr - gridW, curr + gridW];
        for (const n of neighbors) {
          if (n >= 0 && n < gridW * gridH && mask[n] === 1 && visited[n] === 0) {
            const nx = n % gridW;
            if (Math.abs(nx - cx) <= 1) {
              visited[n] = 1;
              stack.push(n);
            }
          }
        }
      }

      // Filter out tiny noise speckles; face region typically occupies >= 3.5% of 80x60 = ~170 pixels
      if (count >= 120) {
        clusters.push({ count, sumX, sumY, minX, maxX, minY, maxY });
      }
    }
  }

  if (clusters.length === 0) {
    return { faceCount: 0, headPose: "Absent" };
  }

  // Sort largest clusters first
  clusters.sort((a, b) => b.count - a.count);
  const primary = clusters[0];
  const centerX = primary.sumX / primary.count / gridW;
  const centerY = primary.sumY / primary.count / gridH;

  let headPose: FaceAnalysisResult["headPose"] = "Centered";
  if (centerX < 0.27) headPose = "Looking Right";
  else if (centerX > 0.73) headPose = "Looking Left";
  else if (centerY < 0.18 || centerY > 0.82) headPose = "Looking Up/Down";

  return {
    faceCount: Math.min(clusters.length, 4),
    headPose,
  };
}

export const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({
  sessionCode,
  studentId,
  studentName,
  enabled,
  inactivityThresholdSec = 30,
  onAlertToast,
  registerPasteHandler,
}) => {
  const [consented, setConsented] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [faceStatus, setFaceStatus] = useState<FaceAnalysisResult>({
    faceCount: 1,
    headPose: "Centered",
  });
  const [localLogs, setLocalLogs] = useState<ActivityLog[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastEventTimeRef = useRef<Record<string, number>>({});
  const consecutiveNoFaceRef = useRef<number>(0);

  const logProctoringEvent = useCallback(
    async (eventType: ProctoringEventType, details: string) => {
      // Debounce identical event types within 4 seconds
      const now = Date.now();
      if (
        eventType !== "copy_paste" &&
        lastEventTimeRef.current[eventType] &&
        now - lastEventTimeRef.current[eventType] < 4000
      ) {
        return;
      }
      lastEventTimeRef.current[eventType] = now;

      try {
        const res = await fetch(`${API_URL}/api/proctoring/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionCode,
            studentId,
            studentName,
            eventType,
            details,
          }),
        });
        const data = await res.json();
        if (data.log) {
          setLocalLogs((prev) => [data.log, ...prev].slice(0, 15));
        }
      } catch (_) {}
    },
    [sessionCode, studentId, studentName]
  );

  // Register Monaco paste callback
  useEffect(() => {
    if (registerPasteHandler) {
      registerPasteHandler((chars: number) => {
        if (enabled && consented) {
          logProctoringEvent("copy_paste", `Pasted ${chars} characters into code editor`);
          if (onAlertToast) {
            onAlertToast("Copy/paste event logged for instructor review", "warning");
          }
        }
      });
    }
  }, [registerPasteHandler, enabled, consented, logProctoringEvent, onAlertToast]);

  // Start / Stop Webcam
  const startWebcam = useCallback(async () => {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setWebcamActive(true);
      logProctoringEvent("webcam_enabled", "Student consented and enabled webcam monitoring");
    } catch (err: any) {
      setWebcamError(err.message || "Webcam permission denied");
      setWebcamActive(false);
      logProctoringEvent("webcam_denied", `Webcam unavailable: ${err.message || "Permission denied"}`);
    }
  }, [logProctoringEvent]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [enabled, stopWebcam]);

  // AI Face Presence, Multiple Face, and Head-Pose Estimation Loop
  useEffect(() => {
    if (!enabled || !consented || !webcamActive) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const w = 80;
      const h = 60;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, w, h);

      let result: FaceAnalysisResult;

      // Use native Chromium FaceDetector if available, otherwise fallback to local Canvas analyzer
      const FaceDetectorCtor = (window as any).FaceDetector;
      if (FaceDetectorCtor) {
        try {
          const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 5 });
          const faces = await detector.detect(video);
          if (faces.length === 0) {
            result = { faceCount: 0, headPose: "Absent" };
          } else {
            const box = faces[0].boundingBox;
            const cx = (box.x + box.width / 2) / (video.videoWidth || 320);
            const cy = (box.y + box.height / 2) / (video.videoHeight || 240);
            let headPose: FaceAnalysisResult["headPose"] = "Centered";
            if (cx < 0.27) headPose = "Looking Right";
            else if (cx > 0.73) headPose = "Looking Left";
            else if (cy < 0.18 || cy > 0.82) headPose = "Looking Up/Down";
            result = { faceCount: faces.length, headPose };
          }
        } catch (_) {
          result = analyzeFrameFallback(ctx, w, h);
        }
      } else {
        result = analyzeFrameFallback(ctx, w, h);
      }

      setFaceStatus(result);

      if (result.faceCount === 0) {
        consecutiveNoFaceRef.current += 1;
        if (consecutiveNoFaceRef.current >= 2) {
          logProctoringEvent("no_face", "Face not detected in webcam frame");
        }
      } else {
        consecutiveNoFaceRef.current = 0;
        if (result.faceCount > 1) {
          logProctoringEvent("multiple_faces", `Detected ${result.faceCount} faces in webcam frame`);
          if (onAlertToast) {
            onAlertToast("Alert: Multiple faces detected in frame", "warning");
          }
        } else if (result.headPose !== "Centered") {
          logProctoringEvent("head_pose_away", `Head-pose estimation: ${result.headPose}`);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [enabled, consented, webcamActive, logProctoringEvent, onAlertToast]);

  // Behavioral Listeners: Tab Switch, Fullscreen Exit, Copy-Paste, Inactivity
  useEffect(() => {
    if (!enabled || !consented) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logProctoringEvent("tab_switch", "Student switched away from the examination tab");
        if (onAlertToast) {
          onAlertToast("Tab switch detected and logged for review", "warning");
        }
      }
    };

    const handleWindowBlur = () => {
      logProctoringEvent("tab_switch", "Examination window lost focus");
    };

    const handleFullscreenChange = () => {
      const full = !!document.fullscreenElement;
      setIsFullscreen(full);
      if (!full) {
        logProctoringEvent("fullscreen_exit", "Student exited full-screen examination mode");
        if (onAlertToast) {
          onAlertToast("Full-screen mode exited", "warning");
        }
      }
    };

    const handleCopy = () => {
      logProctoringEvent("copy_paste", "Copy action detected during assessment");
    };

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);
    window.addEventListener("mousemove", resetActivity);
    window.addEventListener("keydown", resetActivity);
    window.addEventListener("mousedown", resetActivity);

    const inactivityTimer = setInterval(() => {
      const idleSec = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      if (idleSec >= inactivityThresholdSec) {
        logProctoringEvent("inactivity", `No user interaction detected for ${idleSec}s`);
        lastActivityRef.current = Date.now();
      }
    }, 5000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
      window.removeEventListener("mousemove", resetActivity);
      window.removeEventListener("keydown", resetActivity);
      window.removeEventListener("mousedown", resetActivity);
      clearInterval(inactivityTimer);
    };
  }, [enabled, consented, inactivityThresholdSec, logProctoringEvent, onAlertToast]);

  const handleConsentAndStart = async () => {
    setConsented(true);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_) {}
    await startWebcam();
  };

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (_) {}
  };

  if (!enabled) {
    return (
      <div className="bg-[#12121a] border border-gray-800 rounded-xl p-3 text-xs text-gray-400 flex items-center gap-2">
        <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
        <span>Collaborative Lab Mode — Proctoring is disabled for this session.</span>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a] border border-gray-800 rounded-2xl p-3.5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            AI Proctoring Guard
          </span>
        </div>
        {consented ? (
          <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        ) : (
          <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
            Consent Required
          </span>
        )}
      </div>

      {/* Consent Prompt */}
      {!consented ? (
        <div className="bg-[#181824] border border-indigo-500/30 rounded-xl p-3 space-y-2.5">
          <div className="flex items-start gap-2 text-[11px] text-gray-300 leading-relaxed">
            <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
            <p>
              This assessment uses <strong>transparent, consent-based proctoring</strong>:
              webcam face presence, head-pose estimation, tab switches, full-screen exits,
              copy-paste, and inactivity. Signals are flagged as alerts for teacher review,
              not automatic proof of misconduct.
            </p>
          </div>
          <button
            onClick={handleConsentAndStart}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition shadow"
          >
            I Consent — Enable Webcam & Full-Screen
          </button>
        </div>
      ) : (
        <>
          {/* Webcam Preview */}
          <div className="relative rounded-xl overflow-hidden bg-black border border-gray-800 aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${webcamActive ? "block" : "hidden"}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!webcamActive && (
              <div className="text-center p-3 space-y-2">
                <CameraOff size={22} className="text-rose-400 mx-auto" />
                <div className="text-[11px] text-rose-300">
                  {webcamError || "Webcam is turned off"}
                </div>
                <button
                  onClick={startWebcam}
                  className="text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-md font-semibold"
                >
                  Retry Webcam
                </button>
              </div>
            )}

            {/* AI Overlay Badge */}
            {webcamActive && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/75 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-semibold border border-gray-700/70">
                <span
                  className={`flex items-center gap-1 ${
                    faceStatus.faceCount === 1
                      ? "text-emerald-300"
                      : faceStatus.faceCount > 1
                      ? "text-rose-400"
                      : "text-amber-300"
                  }`}
                >
                  {faceStatus.faceCount === 1 ? (
                    <CheckCircle2 size={11} />
                  ) : (
                    <AlertTriangle size={11} />
                  )}
                  {faceStatus.faceCount === 0
                    ? "No Face"
                    : faceStatus.faceCount === 1
                    ? "1 Face"
                    : `${faceStatus.faceCount} Faces!`}
                </span>
                <span className="text-gray-300 font-mono">{faceStatus.headPose}</span>
              </div>
            )}
          </div>

          {/* Fullscreen Warning */}
          {!isFullscreen && (
            <button
              onClick={requestFullscreen}
              className="flex items-center justify-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold py-1.5 px-2.5 rounded-lg transition"
            >
              <Maximize2 size={12} />
              <span>Re-enter Full-Screen Mode</span>
            </button>
          )}

          {/* Webcam Toggle */}
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>Alerts logged: <strong className="text-gray-200">{localLogs.length}</strong></span>
            <button
              onClick={() => {
                if (webcamActive) {
                  stopWebcam();
                  logProctoringEvent("webcam_disabled", "Student turned off webcam");
                } else {
                  startWebcam();
                }
              }}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              {webcamActive ? <CameraOff size={12} /> : <Camera size={12} />}
              <span>{webcamActive ? "Pause Cam" : "Enable Cam"}</span>
            </button>
          </div>

          {/* Recent Local Activity Logs */}
          {localLogs.length > 0 && (
            <div className="bg-[#0d0d13] border border-gray-800 rounded-xl p-2 max-h-28 overflow-y-auto space-y-1">
              {localLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-[10px] px-1.5 py-1 rounded bg-[#161620]"
                >
                  <span className="flex items-center gap-1.5 truncate text-gray-300">
                    <ShieldAlert
                      size={10}
                      className={
                        log.severity === "alert"
                          ? "text-rose-400 shrink-0"
                          : log.severity === "warning"
                          ? "text-amber-400 shrink-0"
                          : "text-indigo-400 shrink-0"
                      }
                    />
                    <span className="truncate">{log.eventType.replace("_", " ")}</span>
                  </span>
                  <span className="text-gray-500 font-mono shrink-0 flex items-center gap-0.5">
                    <Clock size={9} />
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
