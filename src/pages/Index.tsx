import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChildDashboard } from "@/components/dashboard/ChildDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";

const Index = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // If user is a child, show the child dashboard
  if (user?.user_type === 'child') {
    return (
      <DashboardLayout>
        <ChildDashboard user={user} />
      </DashboardLayout>
    );
  }

  // For tutor and sponsor, show the parent dashboard
  return (
    <DashboardLayout>
      <ParentDashboard user={user} />
    </DashboardLayout>
  );
};

export default Index;
