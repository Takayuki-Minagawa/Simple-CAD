import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAbortError, isAbortError, openFileViaInput } from '../fileSystem';

afterEach(() => vi.restoreAllMocks());

describe('fileSystem cancellation', () => {
  it('classifies only AbortError as cancellation', () => {
    expect(isAbortError(createAbortError())).toBe(true);
    expect(isAbortError(new Error('disk failed'))).toBe(false);
  });

  it('settles the fallback input promise when the picker is cancelled', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click(
      this: HTMLInputElement,
    ) {
      this.dispatchEvent(new Event('cancel'));
    });

    await expect(openFileViaInput('.json')).rejects.toMatchObject({ name: 'AbortError' });
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
