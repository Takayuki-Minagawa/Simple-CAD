import { useState, useEffect, useRef, useCallback } from 'react';

export function useMenuState() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu, closeMenu]);

  const toggleMenu = (name: string) => setOpenMenu((prev) => (prev === name ? null : name));

  return { openMenu, closeMenu, toggleMenu, menuBarRef };
}
