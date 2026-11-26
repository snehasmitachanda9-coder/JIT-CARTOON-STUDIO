/**
 * Audio playback, Web Audio lip-sync analyzer, microphone recorder,
 * and MediaStreamAudioDestination mixer for video export.
 */

export class StudioAudioManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private currentAudioEl: HTMLAudioElement | null = null;
  private currentSource: MediaElementAudioSourceNode | null = null;
  private exportDest: MediaStreamAudioDestinationNode | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.6;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getExportAudioStream(): MediaStream | null {
    const ctx = this.ensureContext();
    if (!this.exportDest && typeof ctx.createMediaStreamDestination === 'function') {
      const dest = ctx.createMediaStreamDestination();
      this.exportDest = dest;
      if (this.analyser) {
        this.analyser.connect(dest);
      }
    }
    return this.exportDest ? this.exportDest.stream : null;
  }

  public playSceneAudio(url: string | null | undefined, startOffsetSec = 0): void {
    this.stop();
    if (!url) return;

    try {
      const ctx = this.ensureContext();
      const audio = new Audio();
      audio.src = url;
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';

      const source = ctx.createMediaElementSource(audio);
      if (this.analyser) {
        source.connect(this.analyser);
      } else {
        source.connect(ctx.destination);
      }

      if (startOffsetSec > 0 && Number.isFinite(startOffsetSec)) {
        audio.currentTime = startOffsetSec;
      }

      this.currentAudioEl = audio;
      this.currentSource = source;
      void audio.play().catch(() => {
        // Autoplay or interrupted playback handled gracefully
      });
    } catch {
      // Ignore audio errors if device has no audio output
    }
  }

  public stop(): void {
    if (this.currentAudioEl) {
      try {
        this.currentAudioEl.pause();
        this.currentAudioEl.src = '';
      } catch {
        // ignore
      }
      this.currentAudioEl = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.disconnect();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }
  }

  /**
   * Returns normalized 0..1 vocal amplitude for real-time lip-sync.
   * Returns -1 when no audio track is actively playing.
   */
  public getLipSyncAmplitude(): number {
    if (!this.currentAudioEl || this.currentAudioEl.paused || !this.analyser || !this.freqData) {
      return -1;
    }
    this.analyser.getByteFrequencyData(this.freqData);
    // Focus on speech frequencies (bins 1..24)
    let sum = 0;
    const count = Math.min(24, this.freqData.length);
    for (let i = 1; i < count; i++) {
      sum += this.freqData[i];
    }
    const avg = sum / Math.max(1, count - 1);
    return Math.min(1, avg / 95);
  }

  public dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export interface MicRecordingSession {
  stop: () => Promise<{ url: string; durationSec: number }>;
  cancel: () => void;
  getLevel: () => number;
}

export async function startMicRecording(): Promise<MicRecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  source.connect(analyser);
  const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  recorder.start(100);

  const cleanup = () => {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    getLevel: () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      return Math.min(1, sum / (data.length * 90));
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const durationSec = Math.max(0.5, (performance.now() - startedAt) / 1000);
          cleanup();
          resolve({ url, durationSec });
        };
        if (recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          cleanup();
          resolve({ url: '', durationSec: 0 });
        }
      }),
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      cleanup();
    },
  };
}
