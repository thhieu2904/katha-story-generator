const OUTPUT_SAMPLE_RATE = 16_000;
const FRAME_DURATION_MS = 20;
const ACTIVE_FRAME_RMS = 0.006;
const MIN_PEAK = 0.012;
const MIN_ACTIVE_DURATION_MS = 60;

interface DecodedAudio {
  duration: number;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export class SilentRecordingError extends Error {
  constructor() {
    super('No speech signal was detected');
    this.name = 'SilentRecordingError';
  }
}

function sampleAt(channel: Float32Array, position: number) {
  const left = Math.min(Math.floor(position), channel.length - 1);
  const right = Math.min(left + 1, channel.length - 1);
  const fraction = position - left;
  return channel[left] + (channel[right] - channel[left]) * fraction;
}

export function resampleToMono(
  decoded: Pick<DecodedAudio, 'duration' | 'numberOfChannels' | 'sampleRate' | 'getChannelData'>,
  outputSampleRate = OUTPUT_SAMPLE_RATE,
) {
  const outputLength = Math.max(1, Math.round(decoded.duration * outputSampleRate));
  const output = new Float32Array(outputLength);
  const channels = Array.from(
    { length: decoded.numberOfChannels },
    (_, channel) => decoded.getChannelData(channel),
  );
  const sourceStep = decoded.sampleRate / outputSampleRate;

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * sourceStep;
    let mixed = 0;
    for (const channel of channels) mixed += sampleAt(channel, sourcePosition);
    output[index] = Math.max(-1, Math.min(1, mixed / channels.length));
  }
  return output;
}

export function hasSpeechSignal(samples: Float32Array, sampleRate = OUTPUT_SAMPLE_RATE) {
  const frameSize = Math.max(1, Math.round(sampleRate * FRAME_DURATION_MS / 1000));
  const minimumActiveFrames = Math.max(
    1,
    Math.ceil(MIN_ACTIVE_DURATION_MS / FRAME_DURATION_MS),
  );
  let peak = 0;
  let activeFrames = 0;

  for (let offset = 0; offset < samples.length; offset += frameSize) {
    const end = Math.min(offset + frameSize, samples.length);
    let sumSquares = 0;
    for (let index = offset; index < end; index += 1) {
      const absolute = Math.abs(samples[index]);
      peak = Math.max(peak, absolute);
      sumSquares += samples[index] * samples[index];
    }
    const rms = Math.sqrt(sumSquares / Math.max(end - offset, 1));
    if (rms >= ACTIVE_FRAME_RMS) activeFrames += 1;
  }

  return peak >= MIN_PEAK && activeFrames >= minimumActiveFrames;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeMonoPcmWav(samples: Float32Array, sampleRate = OUTPUT_SAMPLE_RATE) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * bytesPerSample, sample < 0 ? sample * 32768 : sample * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function prepareRecordingWav(blob: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (!decoded.length || !decoded.numberOfChannels || !decoded.duration) {
      throw new SilentRecordingError();
    }
    const samples = resampleToMono(decoded);
    if (!hasSpeechSignal(samples)) throw new SilentRecordingError();
    return {
      blob: encodeMonoPcmWav(samples),
      durationMs: Math.round(samples.length / OUTPUT_SAMPLE_RATE * 1000),
    };
  } finally {
    await context.close();
  }
}
