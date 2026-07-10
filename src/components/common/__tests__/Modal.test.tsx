import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Modal } from '../Modal';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <Modal title="Accessible preview" onClose={() => setOpen(false)}>
          <button>First action</button>
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('labels the dialog, suppresses global shortcuts, closes on Escape, and restores focus', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Accessible preview' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(document.documentElement.dataset.modalOpen).toBe('true');
    await waitFor(() => expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.documentElement.dataset.modalOpen).toBeUndefined();
  });
});
