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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return <PlacementEngine name={name} age={age} />;
}
