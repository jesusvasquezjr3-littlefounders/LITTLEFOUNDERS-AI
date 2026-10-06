import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { publish, author } from '../v2/releaseCli.js';

describe('authoring and live publication cannot skip instructional preflight', () => {
  it('refuses the 36-lesson calibration corpus before environment or network access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Must not reach a service'));
    try {
      await expect(publish({
        plans: fileURLToPath(new URL('../../curriculum-recovery/financial-education/course-plans', import.meta.url)),
        blueprint: fileURLToPath(new URL('../../curriculum-recovery/financial-education/blueprint.json', import.meta.url)),
        'lesson-ids': 'unused-before-calibration-refusal.json',
        course: 'financial-education', 'run-id': 'calibration-refusal', out: 'runs/refusal-test',
      })).rejects.toThrow('Calibration-only');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
  it('refuses a technically valid legacy corpus before environment or network access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Must not reach a service'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await publish({ plans: fileURLToPath(new URL('../v2/fixtures/plans', import.meta.url)), course: 'financial-education', 'run-id': 'refusal-test', out: 'runs/refusal-test' });
      expect(result).toBe(2);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('--blueprint'));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); log.mockRestore(); }
  });
  it('refuses a paid run with missing instructional evidence before invoking a provider', async () => {
    const responder = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await author({ skeleton: fileURLToPath(new URL('../v2/fixtures/plans/01-v2-allocation-bar.json', import.meta.url)), out: 'runs/refusal-test/plan.json', 'max-usd': '1' }, responder);
      expect(result).toBe(2);
      expect(responder).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Missing instructional contract'));
    } finally { log.mockRestore(); }
  });
});
