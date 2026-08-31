import { describe, expect, it } from 'vitest';
import { encodeMonoPcmWav, hasSpeechSignal, resampleToMono } from './recordingAudio';

describe('speaking recording audio', () => {
  it('rejects silence and accepts a sustained speech-like signal', () => {
    expect(hasSpeechSignal(new Float32Array(16_000))).toBe(false);

    const signal = new Float32Array(16_000);
    for (let index = 0; index < signal.length; index += 1) {
      signal[index] = Math.sin(index / 8) * 0.08;
    }
    expect(hasSpeechSignal(signal)).toBe(true);
  });

  it('mixes channels and resamples to 16 kHz', () => {
    const left = new Float32Array(48_000).fill(0.2);
    const right = new Float32Array(48_000).fill(0.4);
    const mono = resampleToMono({
      duration: 1,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: (channel) => channel === 0 ? left : right,
    });

    expect(mono).toHaveLength(16_000);
    expect(mono[8_000]).toBeCloseTo(0.3);
  });

  it('encodes mono 16-bit PCM WAV with a valid header', async () => {
    const wav = encodeMonoPcmWav(new Float32Array([0, 0.5, -0.5]));
    const bytes = new Uint8Array(await wav.arrayBuffer());
    const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

    expect(wav.type).toBe('audio/wav');
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(text(36, 40)).toBe('data');
    expect(bytes).toHaveLength(50);
  });
});
