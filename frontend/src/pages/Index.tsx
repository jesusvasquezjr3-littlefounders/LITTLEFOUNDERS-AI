import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChildDashboard } from "@/components/dashboard/ChildDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { UniversalDashboard } from "@/components/dashboard/UniversalDashboard";

const Index = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

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
