import { Route } from 'react-router-dom';
import { RequireRole } from '@/auth/RequireRole';
import { FamilyPage } from '@/routes/app/family/FamilyPage';
import { KidTerritoryPage } from '@/routes/app/family/KidTerritoryPage';
import { KidTutorPage } from '@/routes/app/family/KidTutorPage';
import { TasksPage } from '@/routes/app/tasks/TasksPage';
import { BankingPage } from '@/routes/app/banking/BankingPage';
import { RequireWalletAccess } from '@/routes/app/wallet/RequireWalletAccess';
import { TeenWalletPage } from '@/routes/app/wallet/TeenWalletPage';

/*
 * Lane 4 (family): the Family Hub and the verified parent's (Tutor's) views,
 * tasks, banking and the independent teen's wallet. App.tsx (Lane 0) mounts
 * these inside the signed-in app shell (RequireAuth + RequireOnboarded).
 */
export const familyShellRoutes = (
  <>
    <Route path="tasks" element={<RequireWalletAccess mode="familyMoney"><TasksPage /></RequireWalletAccess>} />
    <Route path="banking" element={<RequireWalletAccess mode="familyMoney"><BankingPage /></RequireWalletAccess>} />
    <Route path="wallet" element={<RequireWalletAccess mode="teen"><TeenWalletPage /></RequireWalletAccess>} />
    <Route path="family" element={<RequireRole role="parent"><FamilyPage /></RequireRole>} />
    <Route path="family/:kidId/territory" element={<RequireRole role="parent"><KidTerritoryPage /></RequireRole>} />
    {/* Parent visibility into a child's Mentor conversations is a product
        invariant (§1.9), not a feature — same parent gate, and Core
        re-checks the verified guardian link per request. */}
    <Route path="family/:kidId/tutor" element={<RequireRole role="parent"><KidTutorPage /></RequireRole>} />
  </>
);
