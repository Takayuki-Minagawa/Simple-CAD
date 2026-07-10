import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let openModalCount = 0;

function setModalDocumentState(open: boolean) {
  openModalCount = Math.max(0, openModalCount + (open ? 1 : -1));
  if (openModalCount > 0) {
    document.documentElement.dataset.modalOpen = 'true';
  } else {
    delete document.documentElement.dataset.modalOpen;
  }
}

export interface ModalProps {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  contentStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  closeOnBackdrop?: boolean;
  ariaDescription?: string;
}

/**
 * Accessible modal shell shared by application dialogs.
 *
 * It owns focus trapping/restoration, Escape handling and the document-level
 * marker used to suppress CAD keyboard shortcuts while a dialog is open.
 */
export function Modal({
  title,
  children,
  onClose,
  footer,
  width = 560,
  maxWidth = 'calc(100vw - 32px)',
  maxHeight = '86vh',
  contentStyle,
  bodyStyle,
  closeOnBackdrop = true,
  ariaDescription,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setModalDocumentState(true);

    const focusDialog = window.setTimeout(() => {
      const dialog = dialogRef.current;
      const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusDialog);
      document.removeEventListener('keydown', handleKeyDown, true);
      setModalDocumentState(false);
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-modal-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescription ? descriptionId : undefined}
        tabIndex={-1}
        style={{
          width,
          maxWidth,
          maxHeight,
          background: 'var(--bg-modal)',
          color: 'var(--text-primary)',
          borderRadius: 10,
          boxShadow: '0 12px 48px rgba(0,0,0,0.28)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...contentStyle,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: 16 }}>
            {title}
          </h2>
        </div>
        {ariaDescription && (
          <p
            id={descriptionId}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
          >
            {ariaDescription}
          </p>
        )}
        <div style={{ overflow: 'auto', padding: 20, ...bodyStyle }}>{children}</div>
        {footer && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              padding: '12px 20px 16px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
