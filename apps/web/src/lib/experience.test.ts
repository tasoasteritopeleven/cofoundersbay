import { describe, expect, it } from 'vitest';
import { EXPERIENCE_MAX, educationFromLinkedIn, experienceFromLinkedIn, readExperience, spanOf, yearOf } from '@cofounderbay/shared';

describe('experience', () => {
  it('reads a year out of the shapes people and LinkedIn write', () => {
    expect(yearOf('Mar 2021')).toBe('2021');
    expect(yearOf('2019-04')).toBe('2019');
    expect(yearOf('2018')).toBe('2018');
    expect(yearOf('soon')).toBe('');
    expect(yearOf(undefined)).toBe('');
  });

  it('keeps entries with a title or a company, current ones first, capped', () => {
    const rows = [
      { title: 'Engineer', company: 'Old Co', start: '2015', end: '2018' },
      { title: '', company: '', start: '2020' },
      { title: 'Founder', company: 'Harbor', start: 'Jan 2022', end: '' },
      { title: 'Lead', company: 'Mid Co', start: '2018', end: '2021' },
      'nonsense',
    ];
    expect(readExperience(rows).map((e) => e.company)).toEqual(['Harbor', 'Mid Co', 'Old Co']);
    expect(readExperience(Array.from({ length: 30 }, (_, i) => ({ title: `T${i}` })))).toHaveLength(EXPERIENCE_MAX);
    expect(readExperience('x')).toEqual([]);
  });

  it('turns LinkedIn positions and education into entries', () => {
    const imp = {
      positions: [{ company: 'Harbor', title: 'Founder', startedOn: 'Feb 2022', finishedOn: '', location: '', description: '' }],
      education: [{ school: 'NTUA', degree: 'MEng', startDate: '2010', endDate: '2015' }],
    };
    expect(experienceFromLinkedIn(imp)).toEqual([{ title: 'Founder', company: 'Harbor', start: '2022', end: '' }]);
    expect(educationFromLinkedIn(imp)).toEqual([{ school: 'NTUA', degree: 'MEng', start: '2010', end: '2015' }]);
  });

  it('writes the span in both languages', () => {
    expect(spanOf({ start: '2021', end: '' })).toEqual({ en: '2021 – now', el: '2021 – σήμερα' });
    expect(spanOf({ start: '2018', end: '2021' }).el).toBe('2018 – 2021');
    expect(spanOf({ start: '', end: '' }).en).toBe('');
    expect(spanOf({ start: '2010', end: '' }, false).en).toBe('2010');
  });
});
