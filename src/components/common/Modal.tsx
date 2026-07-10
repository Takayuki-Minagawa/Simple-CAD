import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  createContext,
  useEffect,
  useId,
  useContext,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalRegistration {
  dialogRef: RefObject<HTMLDivElement | null>;
  close: () => void;
  depth: number;
}

const modalRegistry: ModalRegistration[] = [];
const ModalDepthContext = createContext(-1);

function syncModalDocumentState() {
  if (modalRegistry.length > 0) {
    document.documentElement.dataset.modalOpen = 'true';
  } else {
    delete document.documentElement.dataset.modalOpen;
  }
}

/** Return the visually topmost portal, independent of React effect order. */
function topModal(): ModalRegistration | undefined {
  return modalRegistry.reduce<ModalRegistration | undefined>((top, candidate) => {
    if (!top) return candidate;
    if (candidate.depth !== top.depth) return candidate.depth > top.depth ? candidate : top;
    const topElement = top.dialogRef.current;
    const candidateElement = candidate.dialogRef.current;
    if (!topElement) return candidate;
    if (!candidateElement) return top;
    return topElement.compareDocumentPosition(candidateElement) & Node.DOCUMENT_POSITION_FOLLOWING
      ? candidate
      : top;
  }, undefined);
}

function focusableElements(dialog: HTMLDivElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

function focusTopModal() {
  const dialog = topModal()?.dialogRef.current;
  if (!dialog) return;
  (dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialog).focus();
}

function handleModalKeyDown(event: KeyboardEvent) {
  const registration = topModal();
  if (!registration) return;

  if (event.key === 'Escape') {
    // Escape is used by IMEs to cancel an active composition. Let it reach the
    // input without treating it as a request to dismiss the dialog.
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    registration.close();
    return;
  }
  if (event.key !== 'Tab') return;

  // Only the top modal owns keyboard navigation. In particular, do not let a
  // second document listener trap the same Tab event in an underlying dialog.
  event.stopImmediatePropagation();
  const dialog = registration.dialogRef.current;
  if (!dialog) return;
  const focusable = focusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function registerModal(registration: ModalRegistration) {
  const installListener = modalRegistry.length === 0;
  modalRegistry.push(registration);
  if (installListener) document.addEventListener('keydown', handleModalKeyDown, true);
  syncModalDocumentState();
}

function unregisterModal(registration: ModalRegistration) {
  const index = modalRegistry.indexOf(registration);
  if (index >= 0) modalRegistry.splice(index, 1);
  if (modalRegistry.length === 0) {
    document.removeEventListener('keydown', handleModalKeyDown, true);
  }
  syncModalDocumentState();
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
  const modalDepth = useContext(ModalDepthContext) + 1;
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
    const registration: ModalRegistration = {
      dialogRef,
      close: () => onCloseRef.current(),
      depth: modalDepth,
    };
    registerModal(registration);

    const focusDialog = window.setTimeout(() => {
      if (topModal() === registration) focusTopModal();
    });
    return () => {
      window.clearTimeout(focusDialog);
      const wasTop = topModal() === registration;
      unregisterModal(registration);
      if (wasTop) {
        if (topModal()) focusTopModal();
        else previouslyFocused?.focus();
      }
    };
  }, [modalDepth]);

  return (
    <ModalDepthContext.Provider value={modalDepth}>
      {createPortal(
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-modal-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000 + modalDepth,
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
      )}
    </ModalDepthContext.Provider>
  );
}
