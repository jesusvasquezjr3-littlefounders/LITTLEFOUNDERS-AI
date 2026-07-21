import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/*
 * Bare trust surface for /login and /signup — no marketing nav or footer
 * (DESIGN.md §Screen Recipes → Auth: "focused single centered column...
 * ONE resting card"). AuthShell renders the actual centered title + card;
 * this layout only owns the full-height background and the same
 * scroll-reset + page-enter motion every other top-level route gets.
 */
export function AuthLayout() {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-base text-content">
      <main key={location.pathname} className="lf-page-enter">
        <Outlet />
      </main>
    </div>
  );
}
