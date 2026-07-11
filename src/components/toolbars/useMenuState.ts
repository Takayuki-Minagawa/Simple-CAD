import { useState, useEffect, useRef, useCallback } from 'react';

export function useMenuState() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLButtonElement>('.menu-trigger');
      const triggers = Array.from(
        menuBarRef.current?.querySelectorAll<HTMLButtonElement>('.menu-trigger') ?? [],
      );
      const focusMenuItem = (last = false) => {
        window.requestAnimationFrame(() => {
          const items = Array.from(
            menuBarRef.current?.querySelectorAll<HTMLButtonElement>(
              '.dropdown-menu button:not([disabled])',
            ) ?? [],
          );
          (last ? items.at(-1) : items[0])?.focus();
        });
      };

      if (trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
        event.preventDefault();
        focusMenuItem(event.key === 'ArrowUp');
        return;
      }
      if (trigger && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const index = triggers.indexOf(trigger);
        if (index < 0 || triggers.length === 0) return;
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const next = triggers[(index + offset + triggers.length) % triggers.length];
        next.focus();
        if (openMenu) {
          next.click();
          focusMenuItem();
        }
        return;
      }
      if (!openMenu) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        const activeTrigger =
          menuBarRef.current?.querySelector<HTMLButtonElement>('.menu-trigger.open');
        closeMenu();
        activeTrigger?.focus();
        return;
      }
      const current = target?.closest<HTMLButtonElement>('.dropdown-menu button');
      if (current && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const activeTrigger =
          menuBarRef.current?.querySelector<HTMLButtonElement>('.menu-trigger.open');
        const index = activeTrigger ? triggers.indexOf(activeTrigger) : -1;
        if (index < 0 || triggers.length === 0) return;
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        triggers[(index + offset + triggers.length) % triggers.length].click();
        focusMenuItem();
        return;
      }
      if (!current || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(
        current
          .closest('.dropdown-menu')
          ?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const index = items.indexOf(current);
      if (event.key === 'Home') items[0].focus();
      else if (event.key === 'End') items[items.length - 1].focus();
      else if (event.key === 'ArrowDown') items[(index + 1) % items.length].focus();
      else items[(index - 1 + items.length) % items.length].focus();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, closeMenu]);

  const toggleMenu = (name: string) => setOpenMenu((prev) => (prev === name ? null : name));

  return { openMenu, closeMenu, toggleMenu, menuBarRef };
}
