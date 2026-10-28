import type { AudioEngine } from './AudioEngine';

/**
 * Reuses fixed buffers so visualization never allocates per frame.
 * Both buffers are sized for fftSize = 2048.
 */
export class AnalyserTap {
  private readonly waveBuffer = new Uint8Array(new ArrayBuffer(2048));
  private readonly spectrumBuffer = new Uint8Array(new ArrayBuffer(1024));

  constructor(private readonly engine: AudioEngine) {}

  get available(): boolean {
    return Boolean(this.engine.analyserNode) && this.engine.running;
  }

  get sampleRate(): number {
    return this.engine.sampleRate;
  }

  get fftSize(): number {
    return this.engine.analyserNode?.fftSize ?? 2048;
  }

  readWaveform(): Uint8Array | null {
    const analyser = this.engine.analyserNode;
    if (!analyser) {
      return null;
    }
    analyser.getByteTimeDomainData(this.waveBuffer);
    return this.waveBuffer;
  }

  readSpectrum(): Uint8Array | null {
    const analyser = this.engine.analyserNode;
    if (!analyser) {
      return null;
    }
    analyser.getByteFrequencyData(this.spectrumBuffer);
    return this.spectrumBuffer;
  }

  binFrequency(index: number): number {
    return (index * this.sampleRate) / this.fftSize;
  }

  binForFrequency(frequency: number): number {
    return Math.max(0, Math.round((frequency * this.fftSize) / this.sampleRate));
  }
}
