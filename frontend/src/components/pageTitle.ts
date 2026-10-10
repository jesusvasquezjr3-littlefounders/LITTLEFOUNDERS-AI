import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

/** What AppShell hands every page through the router's outlet. */
export interface ShellContext {
  setTitle: (title: string | null) => void;
}

/** A page names itself: the shell puts the title in the tab (WCAG 2.4.2) and takes it back when the page leaves. */
export function usePageTitle(title: string) {
  const { setTitle } = useOutletContext<ShellContext>();

  useEffect(() => {
    setTitle(title);

    return () => setTitle(null);
  }, [title, setTitle]);
}
