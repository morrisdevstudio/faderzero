export const MAX_VOICE_RECORDING_DURATION_MS = 10 * 60 * 1000;

const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

export type RecorderState =
  | 'requesting'
  | 'recording'
  | 'review'
  | 'choosingDestination'
  | 'saving'
  | 'error';

export interface CapturedRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface VoiceRecorderCallbacks {
  onElapsed?: (elapsedMs: number) => void;
  onLevel?: (level: number) => void;
  onStopped: (recording: CapturedRecording) => void;
  onError: (error: Error) => void;
}

export interface VoiceRecorderDependencies {
  mediaDevices: Pick<MediaDevices, 'getUserMedia'>;
  MediaRecorderConstructor: typeof MediaRecorder;
  createAudioContext?: () => AudioContext;
  now: () => number;
  setInterval: typeof window.setInterval;
  clearInterval: typeof window.clearInterval;
  setTimeout: typeof window.setTimeout;
  clearTimeout: typeof window.clearTimeout;
  requestAnimationFrame?: typeof window.requestAnimationFrame;
  cancelAnimationFrame?: typeof window.cancelAnimationFrame;
}

function getDefaultDependencies(): VoiceRecorderDependencies {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;

  return {
    mediaDevices: navigator.mediaDevices,
    MediaRecorderConstructor: window.MediaRecorder,
    ...(AudioContextConstructor
      ? { createAudioContext: () => new AudioContextConstructor() }
      : {}),
    now: () => Date.now(),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    ...(window.requestAnimationFrame
      ? { requestAnimationFrame: window.requestAnimationFrame.bind(window) }
      : {}),
    ...(window.cancelAnimationFrame
      ? { cancelAnimationFrame: window.cancelAnimationFrame.bind(window) }
      : {}),
  };
}

export function selectSupportedRecordingMimeType(
  MediaRecorderConstructor: Pick<typeof MediaRecorder, 'isTypeSupported'>
): string | undefined {
  return MIME_TYPE_CANDIDATES.find((mimeType) => MediaRecorderConstructor.isTypeSupported(mimeType));
}

export function getRecordingFileExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export function formatRecordingDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function createDefaultRecordingName(date = new Date()): string {
  const datePart = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(date)
    .replaceAll('/', '-');
  const timePart = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(':', '-');
  return `Idée ${datePart} ${timePart}`;
}

export function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return "L'accès au micro a été refusé. Autorisez le micro dans les réglages du navigateur puis réessayez.";
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Aucun microphone n’est disponible sur cet appareil.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'Le microphone est déjà utilisé ou ne peut pas être démarré.';
    }
  }

  return error instanceof Error ? error.message : "Impossible de démarrer l'enregistrement.";
}

export class VoiceRecorderEngine {
  private readonly dependencies: VoiceRecorderDependencies;
  private readonly callbacks: VoiceRecorderCallbacks;
  private readonly maxDurationMs: number;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private elapsedIntervalId: number | null = null;
  private autoStopTimeoutId: number | null = null;
  private animationFrameId: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private discarded = false;
  private finished = false;
  private cancelRequested = false;

  constructor(
    callbacks: VoiceRecorderCallbacks,
    options: {
      maxDurationMs?: number;
      dependencies?: VoiceRecorderDependencies;
    } = {}
  ) {
    this.callbacks = callbacks;
    this.maxDurationMs = options.maxDurationMs ?? MAX_VOICE_RECORDING_DURATION_MS;
    this.dependencies = options.dependencies ?? getDefaultDependencies();
  }

  async start(): Promise<void> {
    if (this.recorder) {
      throw new Error('Un enregistrement est déjà en cours.');
    }

    const { MediaRecorderConstructor, mediaDevices } = this.dependencies;
    if (!mediaDevices?.getUserMedia || !MediaRecorderConstructor) {
      throw new Error("Ce navigateur ne prend pas en charge l'enregistrement audio.");
    }
    if (window.isSecureContext === false) {
      throw new Error("L'enregistrement nécessite une connexion HTTPS sécurisée.");
    }

    try {
      this.cancelRequested = false;
      this.stream = await mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (this.cancelRequested) {
        throw new Error('Enregistrement annulé.');
      }

      const mimeType = selectSupportedRecordingMimeType(MediaRecorderConstructor);
      this.recorder = mimeType
        ? new MediaRecorderConstructor(this.stream, { mimeType, audioBitsPerSecond: 128_000 })
        : new MediaRecorderConstructor(this.stream, { audioBitsPerSecond: 128_000 });
      this.chunks = [];
      this.discarded = false;
      this.finished = false;

      this.recorder.addEventListener('dataavailable', this.handleDataAvailable);
      this.recorder.addEventListener('stop', this.handleStop);
      this.recorder.addEventListener('error', this.handleRecorderError);
      this.startedAt = this.dependencies.now();
      this.recorder.start(1000);
      this.startElapsedTimer();
      this.startLevelMeter();
      this.autoStopTimeoutId = this.dependencies.setTimeout(() => {
        void this.stop();
      }, this.maxDurationMs);
    } catch (error) {
      await this.releaseResources();
      throw new Error(getMicrophoneErrorMessage(error));
    }
  }

  async stop(): Promise<void> {
    if (!this.recorder || this.recorder.state === 'inactive') {
      return;
    }
    this.clearTimers();
    this.recorder.stop();
  }

  cancel(): void {
    this.cancelRequested = true;
    this.discarded = true;
    this.clearTimers();
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
      return;
    }
    void this.releaseResources();
  }

  private readonly handleDataAvailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      this.chunks.push(event.data);
    }
  };

  private readonly handleStop = () => {
    if (this.finished) return;
    this.finished = true;
    this.clearTimers();

    const recorderMimeType = this.recorder?.mimeType || this.chunks[0]?.type || 'audio/webm';
    const recording: CapturedRecording = {
      blob: new Blob(this.chunks, { type: recorderMimeType }),
      mimeType: recorderMimeType,
      durationMs: Math.min(this.maxDurationMs, Math.max(0, this.dependencies.now() - this.startedAt)),
    };
    const wasDiscarded = this.discarded;

    void this.releaseResources().then(() => {
      if (wasDiscarded) return;
      if (recording.blob.size === 0) {
        this.callbacks.onError(new Error("Aucun son n'a été enregistré. Réessayez en vérifiant le microphone."));
        return;
      }
      this.callbacks.onElapsed?.(recording.durationMs);
      this.callbacks.onLevel?.(0);
      this.callbacks.onStopped(recording);
    });
  };

  private readonly handleRecorderError = () => {
    if (this.finished) return;
    this.finished = true;
    this.clearTimers();
    void this.releaseResources().then(() => {
      if (!this.discarded) {
        this.callbacks.onError(new Error("L'enregistrement a été interrompu par le navigateur."));
      }
    });
  };

  private startElapsedTimer() {
    this.callbacks.onElapsed?.(0);
    this.elapsedIntervalId = this.dependencies.setInterval(() => {
      const elapsedMs = Math.min(this.maxDurationMs, this.dependencies.now() - this.startedAt);
      this.callbacks.onElapsed?.(elapsedMs);
    }, 250);
  }

  private startLevelMeter() {
    if (!this.stream || !this.dependencies.createAudioContext) return;

    try {
      this.audioContext = this.dependencies.createAudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
      this.measureLevel();
    } catch {
      this.analyser = null;
      if (this.audioContext) {
        void this.audioContext.close();
        this.audioContext = null;
      }
    }
  }

  private readonly measureLevel = () => {
    if (!this.analyser) return;
    const values = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(values);
    let energy = 0;
    for (const value of values) {
      const normalized = (value - 128) / 128;
      energy += normalized * normalized;
    }
    const rms = Math.sqrt(energy / values.length);
    this.callbacks.onLevel?.(Math.min(1, rms * 5));

    if (this.dependencies.requestAnimationFrame) {
      this.animationFrameId = this.dependencies.requestAnimationFrame(this.measureLevel);
    }
  };

  private clearTimers() {
    if (this.elapsedIntervalId !== null) {
      this.dependencies.clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = null;
    }
    if (this.autoStopTimeoutId !== null) {
      this.dependencies.clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
    if (this.animationFrameId !== null && this.dependencies.cancelAnimationFrame) {
      this.dependencies.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private async releaseResources() {
    this.clearTimers();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;

    if (this.audioContext) {
      const audioContext = this.audioContext;
      this.audioContext = null;
      await audioContext.close().catch(() => undefined);
    }

    if (this.recorder) {
      this.recorder.removeEventListener('dataavailable', this.handleDataAvailable);
      this.recorder.removeEventListener('stop', this.handleStop);
      this.recorder.removeEventListener('error', this.handleRecorderError);
      this.recorder = null;
    }
  }
}
