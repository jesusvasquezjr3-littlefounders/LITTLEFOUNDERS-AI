import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChildDashboard } from "@/components/dashboard/ChildDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { UniversalDashboard } from "@/components/dashboard/UniversalDashboard";
import { isGuest, getGuestProfile, getPendingMerge, clearPendingMerge } from "@/lib/guestProfile";
import { API_URL } from "@/config/api";

const Index = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    // Retry a pending guest merge that failed during registration/OAuth callback.
    // This ensures XP and streak are never lost even if the merge API was unreachable.
    const retryPendingMerge = async () => {
      const token = localStorage.getItem('token');
      const pending = getPendingMerge();
      if (!token || !pending) return;
      try {
        const res = await fetch(`${API_URL}/auth/merge-guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: pending.name,
            age: pending.age,
            interests: pending.interests,
            experience_level: pending.experience_level,
            preferred_language: pending.preferred_language,
            xp: pending.xp,
            current_streak: pending.current_streak ?? 1,
            steps_completed: 5,
          }),
        });
        if (res.ok) {
          clearPendingMerge();
          // Refresh the local user object with merged XP/streak
          const raw = localStorage.getItem('user');
          if (raw) {
            const stored = JSON.parse(raw);
            const updated = {
              ...stored,
              points_earned: (stored.points_earned || 0) + (pending.xp || 0),
              current_streak: Math.max(stored.current_streak || 0, pending.current_streak || 1),
              max_streak: Math.max(stored.max_streak || 0, pending.max_streak || 1),
            };
            localStorage.setItem('user', JSON.stringify(updated));
            setUser(updated);
          }
        }
      } catch { /* will retry next time */ }
    };

    retryPendingMerge();
  }, []);

  // Guest users (no auth but completed onboarding) →
  // Same full UniversalDashboard experience with a virtual user built from their profile.
  if (!user && isGuest()) {
    const gp = getGuestProfile();
    const virtualUser = {
      name: gp?.name || '',
      user_type: 'universal',
      points_earned: gp?.xp ?? 0,
      current_streak: gp?.current_streak ?? 0,
      lessons_completed: gp?.lessons_completed ?? 0,
      minutes_studied: 0,
      avatar_config: null,
    };
    return (
      <DashboardLayout>
        <UniversalDashboard user={virtualUser} />
      </DashboardLayout>
    );
  }

  // Admin users get redirected to their own panel
  if (user?.user_type === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // If user is a child, show the child dashboard
  if (user?.user_type === 'child') {
    return (
      <DashboardLayout>
        <ChildDashboard user={user} />
      </DashboardLayout>
    );
  }

  // If user is universal, show the universal dashboard
  if (user?.user_type === 'universal') {
    return (
      <DashboardLayout>
        <UniversalDashboard user={user} />
      </DashboardLayout>
    );
  }

  // For tutor, show the parent dashboard
  return (
    <DashboardLayout>
      <ParentDashboard user={user} />
    </DashboardLayout>
  );
};

export default Index;
