import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  FlipHorizontal,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  WifiOff,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { School, ScanResult } from '../types';
import { supabaseService } from '../services/supabaseService';
import { playSuccessBeep, playDuplicateWarningBeep, playErrorBeep } from '../services/audio';

interface ScannerViewProps {
  school: School;
  operatorId?: string;
  onAttendanceRecorded?: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  school,
  operatorId,
  onAttendanceRecorded
}) => {
  const [scannerState, setScannerState] = useState<'idle' | 'starting' | 'scanning' | 'permission_denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isOnline, setIsOnline] = useState(supabaseService.getOnlineStatus());
  
  // Active Scan Result Modal / Card
  const [activeResult, setActiveResult] = useState<ScanResult | null>(null);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [lastScannedToken, setLastScannedToken] = useState<string>('');

  // Manual fallback simulation input for desktop testing
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isProcessingManual, setIsProcessingManual] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'edupulse-qr-reader';
  const isCooldownRef = useRef(false);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      stopScanner();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (isCooldownRef.current) return;
    
    // Check if same token is rapidly detected in camera frame
    if (decodedText === lastScannedToken && scanCooldown) return;

    isCooldownRef.current = true;
    setScanCooldown(true);
    setLastScannedToken(decodedText);

    try {
      const result = await supabaseService.recordQRAttendance(decodedText, school.id, operatorId);
      setActiveResult(result);

      if (result.success) {
        playSuccessBeep();
        if (onAttendanceRecorded) onAttendanceRecorded();
      } else if (result.errorCode === 'ALREADY_SCANNED_TODAY') {
        playDuplicateWarningBeep();
      } else {
        playErrorBeep();
      }
    } catch (err: unknown) {
      playErrorBeep();
      setActiveResult({
        success: false,
        errorCode: 'SERVER_ERROR',
        message: (err as Error).message || 'Verification failed.'
      });
    } finally {
      // Auto-dismiss result card and ready scanner for the next student
      setTimeout(() => {
        isCooldownRef.current = false;
        setScanCooldown(false);
        setActiveResult(null);
      }, 2200);
    }
  }, [school.id, operatorId, lastScannedToken, scanCooldown, onAttendanceRecorded]);

  const startScanner = useCallback(async () => {
    if (!isOnline) {
      setScannerState('error');
      setErrorMessage('Cannot start scanner while offline. Please connect to internet.');
      return;
    }

    try {
      setScannerState('starting');
      setErrorMessage('');

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {
          // ignore
        }
      }

      const qrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      html5QrCodeRef.current = qrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.72);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0
      };

      await qrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame parsed without QR, quiet continue
        }
      );

      setScannerState('scanning');

      // Check torch capability
      try {
        const capabilities = qrCode.getRunningTrackCapabilities();
        if (capabilities && (capabilities as unknown as { torch?: boolean }).torch) {
          setTorchSupported(true);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err: unknown) {
      console.warn('Camera initiation failed:', err);
      const str = String(err);
      if (str.includes('NotAllowedError') || str.includes('Permission')) {
        setScannerState('permission_denied');
        setErrorMessage('Camera access was blocked by the browser. Please grant permission in your browser address bar.');
      } else {
        setScannerState('error');
        setErrorMessage('No camera found or camera is occupied by another application.');
      }
    }
  }, [facingMode, isOnline, handleScanSuccess]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
    }
    setScannerState('idle');
  }, []);

  const toggleCamera = async () => {
    await stopScanner();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !torchSupported) return;
    try {
      const next = !torchEnabled;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet]
      });
      setTorchEnabled(next);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const handleManualScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTokenInput.trim() || isProcessingManual) return;
    setIsProcessingManual(true);
    await handleScanSuccess(manualTokenInput.trim());
    setIsProcessingManual(false);
    setManualTokenInput('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      {/* Top Status & Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>QR Attendance Scanner</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
              Strict Single-Scan
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Hold student badge inside target square. Instant audio beep verifies check-in.
          </p>
        </div>

        {/* Camera Quick Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${
                torchEnabled
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
              title="Toggle Flashlight / Torch"
            >
              {torchEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              <span className="hidden sm:inline">Torch</span>
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-medium flex items-center gap-1.5 transition"
            title="Switch between Rear and Front camera"
          >
            <FlipHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">{facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}</span>
          </button>

          <button
            onClick={startScanner}
            className="p-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            title="Restart Camera"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Viewfinder & Scan Box Container */}
      <div className="relative bg-stone-950 rounded-2xl overflow-hidden shadow-xl border border-stone-800 aspect-square sm:aspect-4/3 max-h-[540px] flex items-center justify-center">
        {/* HTML5 QR Code Container */}
        <div id={scannerContainerId} className="w-full h-full object-cover" />

        {/* Active Scanning Reticle Overlay */}
        {scannerState === 'scanning' && !activeResult && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-orange-500/70 rounded-2xl flex items-center justify-center overflow-hidden">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />

              {/* Animated Laser Pulse line */}
              <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-pulse top-1/2 -translate-y-1/2 shadow-lg shadow-orange-500/50" />
            </div>

            <p className="mt-4 text-xs font-medium text-stone-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 tracking-wide">
              Center QR code inside square
            </p>
          </div>
        )}

        {/* Offline Warning State */}
        {!isOnline && (
          <div className="absolute inset-0 bg-stone-950/90 z-20 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 mb-3">
              <WifiOff className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">Network Offline</h3>
            <p className="text-xs text-stone-400 max-w-sm mt-1 mb-4 leading-relaxed">
              Attendance recording is strictly online-only to guarantee instantaneous single-scan validation. Scanning will automatically resume when network is restored.
            </p>
          </div>
        )}

        {/* Permission Denied State */}
        {scannerState === 'permission_denied' && (
          <div className="absolute inset-0 bg-stone-950/95 z-20 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-14 h-14 rounded-full bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400 mb-3">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">Camera Permission Required</h3>
            <p className="text-xs text-stone-400 max-w-sm mt-1 mb-4 leading-relaxed">
              {errorMessage || 'EduPulse needs access to your camera to scan student ID badges.'}
            </p>
            <button
              onClick={startScanner}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Try Again & Grant Permission
            </button>
          </div>
        )}

        {/* Feedback Modal / Overlay: Green Success, Amber Duplicate, Red Error */}
        {activeResult && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150">
            {activeResult.success ? (
              /* GREEN SUCCESS CARD */
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-emerald-500 overflow-hidden text-stone-900">
                <div className="bg-emerald-600 px-5 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-white shrink-0 animate-bounce" />
                    <div>
                      <h4 className="text-base font-bold leading-tight">Check-In Verified</h4>
                      <p className="text-xs text-emerald-100 font-medium">Recorded in Database</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full tracking-wider ${
                      activeResult.attendance?.status === 'late'
                        ? 'bg-amber-400 text-stone-950'
                        : 'bg-white text-emerald-800'
                    }`}
                  >
                    {activeResult.attendance?.status === 'late' ? 'LATE' : 'PRESENT'}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Student Photo */}
                    <div className="w-16 h-16 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {activeResult.student?.photoUrl ? (
                        <img
                          src={activeResult.student.photoUrl}
                          alt={activeResult.student.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-stone-400">
                          {activeResult.student?.fullName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h3 className="text-lg font-bold text-stone-900 truncate font-display">
                        {activeResult.student?.fullName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span>Roll: <strong>#{activeResult.student?.rollNumber}</strong></span>
                        <span>·</span>
                        <span>{activeResult.student?.className} ({activeResult.student?.sectionName})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">
                          {activeResult.attendance?.localTimeFormatted || 'Just now'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                    <span>ID: {activeResult.student?.admissionNumber}</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Ready for next scan
                    </span>
                  </div>
                </div>
              </div>
            ) : activeResult.errorCode === 'ALREADY_SCANNED_TODAY' ? (
              /* AMBER DUPLICATE WARNING CARD */
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-amber-500 overflow-hidden text-stone-900">
                <div className="bg-amber-500 px-5 py-4 text-white flex items-center gap-2.5">
                  <AlertTriangle className="w-6 h-6 text-white shrink-0" />
                  <div>
                    <h4 className="text-base font-bold leading-tight">Already Scanned Today</h4>
                    <p className="text-xs text-amber-100 font-medium">Duplicate scan ignored</p>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-bold text-stone-900 font-display">
                    {activeResult.student?.fullName || 'Student'}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1">
                    This student was already marked present today. Each student is registered only once per school day.
                  </p>

                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                    <span>First Scan Recorded:</span>
                    <strong className="font-mono tabular-nums">
                      {activeResult.existingRecord?.checkedInAt
                        ? new Date(activeResult.existingRecord.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Earlier Today'}
                    </strong>
                  </div>

                  <p className="text-[11px] text-stone-400 text-right mt-3">
                    Resuming scanner...
                  </p>
                </div>
              </div>
            ) : (
              /* RED ERROR CARD */
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-rose-500 overflow-hidden text-stone-900">
                <div className="bg-rose-600 px-5 py-4 text-white flex items-center gap-2.5">
                  <XCircle className="w-6 h-6 text-white shrink-0" />
                  <div>
                    <h4 className="text-base font-bold leading-tight">Verification Failed</h4>
                    <p className="text-xs text-rose-100 font-medium">Invalid or Revoked Badge</p>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-stone-700 font-medium">
                    {activeResult.message}
                  </p>
                  <p className="text-xs text-stone-500 mt-2">
                    Please ensure the student has a valid active QR badge issued by {school.name}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Token Verification Console (Crucial for desktop development and manual testing) */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="manual-token" className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            Quick Token Verification / Manual Input
          </label>
          <span className="text-[11px] text-stone-400">
            For testing or manual student barcode check-in
          </span>
        </div>

        <form onSubmit={handleManualScanSubmit} className="flex gap-2">
          <input
            id="manual-token"
            type="text"
            value={manualTokenInput}
            onChange={(e) => setManualTokenInput(e.target.value)}
            placeholder="Paste student QR token (e.g. edupulse_sec_a101b202c303d404e505f606a707b808)..."
            className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-mono"
          />
          <button
            type="submit"
            disabled={!manualTokenInput.trim() || isProcessingManual}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shrink-0 whitespace-nowrap"
          >
            {isProcessingManual ? 'Validating...' : 'Submit Token'}
          </button>
        </form>

        {/* Quick Demo Student Scanner Triggers */}
        <div className="mt-3 pt-3 border-t border-stone-100">
          <p className="text-[11px] text-stone-500 font-medium mb-1.5">
            Quick Test Scans (Click any student to simulate camera scan):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { name: 'Alexander Morgan (Roll 01)', token: 'edupulse_sec_a101b202c303d404e505f606a707b808' },
              { name: 'Sophia Chen (Roll 02)', token: 'edupulse_sec_b202c303d404e505f606a707b808c909' },
              { name: 'Liam Patel (Roll 03 - Unscanned)', token: 'edupulse_sec_c303d404e505f606a707b808c909d010' },
              { name: 'Emily Watson (Roll 04 - Unscanned)', token: 'edupulse_sec_d404e505f606a707b808c909d010e111' },
              { name: 'Invalid Token Test', token: 'edupulse_sec_invalid_fake_token_12345' }
            ].map((demo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleScanSuccess(demo.token)}
                className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-orange-50 hover:text-orange-700 text-stone-700 rounded-md border border-stone-200 transition"
              >
                Scan: {demo.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
