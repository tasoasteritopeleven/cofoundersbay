import { describe, expect, it } from 'vitest';
import { breakdownText } from './api';

/**
 * The match breakdown's strengths and friction points arrive as objects from
 * the API and as strings from older callers. Rendered as they came, an object
 * crashed the /matches compatibility dialog and /matches/compare ("Objects
 * are not valid as a React child"). What is asserted: each shape becomes the
 * words a reader sees, and anything else is dropped rather than rendered.
 */
describe('breakdownText', () => {
  it('reads a strength object as its label', () => {
    expect(breakdownText({ icon: 'terminal', label: 'TypeScript' })).toBe('TypeScript');
  });
  it('reads a friction point as its title and description', () => {
    expect(breakdownText({ icon: 'schedule', title: 'Location Difference', description: 'Athens vs Berlin.' })).toBe('Location Difference: Athens vs Berlin.');
    expect(breakdownText({ icon: 'schedule', title: 'Location Difference', description: '' })).toBe('Location Difference');
  });
  it('passes a string through and drops what it cannot read', () => {
    expect(breakdownText('Both of you work on logistics.')).toBe('Both of you work on logistics.');
    expect(breakdownText(null)).toBeNull();
    expect(breakdownText({ icon: 'x' })).toBeNull();
  });
});
