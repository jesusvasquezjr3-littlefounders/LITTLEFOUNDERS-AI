import { Navigate } from 'react-router-dom';

/**
 * Compatibility entry point for existing admin bookmarks. Learning and
 * behavioural intelligence now lives in one consent-aware console.
 */
export function AdminInsightsPage() {
  return <Navigate to="/admin/intel?focus=learning" replace />;
}

export default AdminInsightsPage;
