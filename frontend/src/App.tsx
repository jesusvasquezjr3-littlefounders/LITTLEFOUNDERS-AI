import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireRole } from '@/auth/RequireRole';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { ComingSoon } from '@/routes/marketing/ComingSoon';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { AppLayout } from '@/routes/app/AppLayout';
import { LearnPage } from '@/routes/app/LearnPage';
import { SectionComingSoon } from '@/routes/app/SectionComingSoon';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Marketing + auth (marketing chrome) */}
        <Route element={<MarketingLayout />}>
          <Route index element={<Landing />} />
          <Route path="how-it-works" element={<ComingSoon page="howItWorks" />} />
          <Route path="families" element={<ComingSoon page="families" />} />
          <Route path="faq" element={<ComingSoon page="faq" />} />
          <Route path="legal/terms" element={<LegalPage doc="terms" />} />
          <Route path="legal/privacy" element={<LegalPage doc="privacy" />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route
            path="verify-parent"
            element={
              <RequireAuth>
                <VerifyParentPage />
              </RequireAuth>
            }
          />
        </Route>

        {/* App (dashboard chrome — sections come from routes/app/navConfig) */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="learn" element={<LearnPage />} />
          <Route path="tutor" element={<SectionComingSoon section="tutor" icon="smart_toy" />} />
          <Route path="games" element={<SectionComingSoon section="games" icon="stadia_controller" />} />
          <Route
            path="tasks"
            element={
              <RequireRole role="parent">
                <SectionComingSoon section="tasks" icon="checklist" />
              </RequireRole>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
