import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MorphIcon } from 'morphicons/react';
import { LogIn, Mail, X } from 'lucide';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GoogleMark } from '@/components/icons/google';
import { LoopVideo } from '@/features/landing/LoopVideo';
import { AUTH_TARGETS, type AuthAction } from '@/lib/authRoutes';
import { useCoreCopy } from '@/i18n/useCopy';

/*
 * "Sign in" in the topbar and the window it opens: Google, email or username, and a way to create an
 * account. There is no sign-in page; the choices live in this window. Every action reads its
 * destination from `lib/authRoutes.ts`; until one is set the action says so in a toast.
 *
 * The scene at the top is a looping video (Rho and Dina at a table under floating glass screens,
 * `tools/render/`). It takes at most 30 % of the window's height, runs to the window's edges and sits on the
 * window's own color, faded at its borders, so it has no visible frame. The close button comes last in the
 * focus order: the first thing a keyboard visitor reaches is the first way to sign in.
 */

/** True below the width where the topbar has room for the word "Sign in" beside the two round controls. */
function useCompactTopbar() {
  const query = '(max-width: 479px)';
  const [compact, setCompact] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setCompact(list.matches);

    list.addEventListener('change', update);

    return () => list.removeEventListener('change', update);
  }, []);

  return compact;
}

export function SignInDialog() {
  const copy = useCoreCopy();
  const compact = useCompactTopbar();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (action: AuthAction) => {
    const target = AUTH_TARGETS[action];

    if (target === null) {
      sileo.info({ title: copy.auth.soon });

      return;
    }

    setOpen(false);
    void navigate(target);
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      {compact
        ? <Button type="button" data-icon-only className="size-12 min-w-0 p-0" aria-label={copy.siteShell.signIn} title={copy.siteShell.signIn}>
          <MorphIcon icon={LogIn} size={22} strokeWidth={2} reducedMotion="user" />
        </Button>
        : <Button type="button" size="sm">{copy.siteShell.signIn}</Button>}
    </DialogTrigger>
    <DialogContent className="!w-[min(420px,calc(100%-32px))] !gap-0 overflow-hidden !p-0 text-center">
      <div className="h-[116px] w-full [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent),linear-gradient(to_bottom,black_78%,transparent)] [mask-composite:intersect]">
        <LoopVideo name="signin" className="size-full object-cover" />
      </div>
      <div className="grid gap-5 px-6 pb-6 pt-4">
        <DialogTitle className="!pt-0 text-balance">{copy.auth.title}</DialogTitle>
        <DialogDescription className="sr-only">{copy.auth.description}</DialogDescription>
        <div className="grid gap-3">
          <Button type="button" variant="outline" fullWidth onClick={() => go('google')}>
            <GoogleMark className="size-5 shrink-0" />{copy.auth.google}
          </Button>
          <Button type="button" fullWidth onClick={() => go('emailOrUsername')}>
            <MorphIcon icon={Mail} size={20} strokeWidth={2} reducedMotion="user" />{copy.auth.emailOrUsername}
          </Button>
        </div>
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-2 text-[length:var(--fs-body)] text-[color:var(--v-text-2)]">
          {copy.auth.newHere}
          <Button type="button" variant="ghost" size="sm" className="font-semibold underline underline-offset-4" onClick={() => go('signUp')}>{copy.auth.createAccount}</Button>
        </p>
      </div>
      <DialogClose asChild>
        <Button type="button" variant="outline" data-icon-only className="absolute end-2 top-2 size-12 min-w-0 bg-[color-mix(in_srgb,var(--v-canvas)_85%,transparent)] p-0" aria-label={copy.auth.close} title={copy.auth.close}>
          <MorphIcon icon={X} size={22} strokeWidth={2} reducedMotion="user" />
        </Button>
      </DialogClose>
    </DialogContent>
  </Dialog>;
}
