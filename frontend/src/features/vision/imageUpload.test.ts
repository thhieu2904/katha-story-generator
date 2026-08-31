import { describe, expect, it } from 'vitest';
import {
  prepareVisionImage,
  VisionImagePreparationError,
} from './imageUpload';

describe('prepareVisionImage', () => {
  it('accepts a camera JPEG whose browser omitted the MIME type', async () => {
    const source = new File(['jpeg'], 'camera.JPG', { type: '' });

    const prepared = await prepareVisionImage(source);

    expect(prepared.type).toBe('image/jpeg');
    expect(prepared.name).toBe('camera.JPG');
    expect(prepared.size).toBe(source.size);
  });

  it('rejects an empty camera result before calling the API', async () => {
    const source = new File([], 'camera.jpg', { type: 'image/jpeg' });

    await expect(prepareVisionImage(source)).rejects.toMatchObject({
      code: 'unsupported',
    } satisfies Partial<VisionImagePreparationError>);
  });
});
