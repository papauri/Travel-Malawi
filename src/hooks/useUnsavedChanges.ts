import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Prevents the user from accidentally leaving the page if they have unsaved changes.
 * Handles both native browser navigation (closing tab, refresh) and React Router navigation.
 * 
 * Returns the blocker object so the component can render a custom ConfirmDialog when blocker.state === 'blocked'.
 */
export function useUnsavedChanges(isDirty: boolean) {
  // 1. Native browser navigation (close tab, refresh, external links)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Required by most modern browsers to show the prompt
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // 2. React Router navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  return blocker;
}
