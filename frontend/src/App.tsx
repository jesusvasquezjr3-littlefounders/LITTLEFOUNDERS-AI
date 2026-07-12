import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { Landing } from '@/routes/marketing/Landing';
import { ComingSoon } from '@/routes/marketing/ComingSoon';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';

export function App() {
  return (
    <AuthProvider>
      <Routes>
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
      </Routes>
    </AuthProvider>
  );
}
