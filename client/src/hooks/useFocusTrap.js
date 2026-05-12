import { useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/* When `open` flips true, focus moves into `containerRef` and Tab/Shift+Tab
 * cycles inside it. When `open` flips false, focus restores to whatever was
 * focused before opening. */
export default function useFocusTrap(containerRef, open) {
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const root = containerRef.current;
    const previouslyFocused = document.activeElement;

    function focusables() {
      return Array.from(root.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
    }

    // Move focus inside on open (first focusable, or container itself).
    const initial = focusables()[0] || root;
    initial.focus?.();

    function onKey(e) {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to where the user was, if that element still exists.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.();
      }
    };
  }, [open, containerRef]);
}
