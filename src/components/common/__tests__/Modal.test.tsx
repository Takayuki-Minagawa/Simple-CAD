import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

function NestedHarness() {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(true);
  return outerOpen ? (
    <Modal title="Outer dialog" onClose={() => setOuterOpen(false)}>
      <button>Outer action</button>
      {innerOpen && (
        <Modal title="Inner dialog" onClose={() => setInnerOpen(false)}>
          <button>Inner action</button>
        </Modal>
      )}
    </Modal>
  ) : null;
}

function StackedHarness() {
  const [firstOpen, setFirstOpen] = useState(true);
  const [secondOpen, setSecondOpen] = useState(true);
  return (
    <>
      {firstOpen && (
        <Modal title="First dialog" onClose={() => setFirstOpen(false)}>
          First
        </Modal>
      )}
      {secondOpen && (
        <Modal title="Second dialog" onClose={() => setSecondOpen(false)}>
          Second
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

  it('lets only the top modal handle Escape and Tab', async () => {
    render(<NestedHarness />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Inner dialog' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'Outer dialog' })).toBeInTheDocument();
    expect(document.documentElement.dataset.modalOpen).toBe('true');
    expect(screen.getByRole('button', { name: 'Outer action' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.documentElement.dataset.modalOpen).toBeUndefined();
  });

  it('closes only the latest same-level modal and stops later document listeners', async () => {
    render(<StackedHarness />);
    const laterListener = vi.fn();
    document.addEventListener('keydown', laterListener, true);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Second dialog' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: 'First dialog' })).toBeInTheDocument();
    expect(laterListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', laterListener, true);
  });

  it('does not close for Escape while an IME composition is active', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

    fireEvent.keyDown(document, { key: 'Escape', isComposing: true, keyCode: 229 });

    expect(screen.getByRole('dialog', { name: 'Accessible preview' })).toBeInTheDocument();
  });
});
