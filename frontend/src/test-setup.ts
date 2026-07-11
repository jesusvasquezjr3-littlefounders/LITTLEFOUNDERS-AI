import '@testing-library/jest-dom/vitest';
import '@/i18n';

// jsdom doesn't implement scrollTo — stub it so the scroll-to-top-on-route-change
// effect (MarketingLayout) doesn't spam "Not implemented" errors in test output.
window.scrollTo = () => {};
