import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getGuestProfile } from '@/lib/guestProfile';
import { PlacementEngine } from '@/features/placement/PlacementEngine';

export default function PlacementPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(18);

  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    const guest = getGuestProfile();

    // No session at all → onboarding
    if (!userRaw && !guest) {
      navigate('/onboarding', { replace: true });
      return;
    }

    // Auth user — placement not yet wired for auth; send to /learn
    if (userRaw) {
      navigate('/learn', { replace: true });
      return;
    }

    // Guest already placed (or skipped) → go to /learn
    if (guest?.placement) {
      navigate('/learn', { replace: true });
      return;
    }

    // Guest without completed onboarding → back to onboarding
    if (!guest?.onboarding_completed) {
      navigate('/onboarding', { replace: true });
      return;
    }

    setName(guest.name || '');
    setAge(typeof guest.age === 'number' ? guest.age : 18);
    setReady(true);
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <Loader2 className="relative z-10 h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return <PlacementEngine name={name} age={age} />;
}
