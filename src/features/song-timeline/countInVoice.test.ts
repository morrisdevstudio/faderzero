import { describe, expect, it } from 'vitest';
import { countInVoiceBufferIndex } from './countInVoice';

describe('countInVoice', () => {
  it('maps the first eight pulses to spoken samples and ignores the rest', () => {
    expect(countInVoiceBufferIndex(0)).toBe(0);
    expect(countInVoiceBufferIndex(7)).toBe(7);
    expect(countInVoiceBufferIndex(8)).toBeNull();
    expect(countInVoiceBufferIndex(-1)).toBeNull();
  });
});
