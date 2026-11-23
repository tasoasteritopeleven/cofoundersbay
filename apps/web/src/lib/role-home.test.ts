import { describe, expect, it } from 'vitest';
import { HOME_COPY, homeAudience, homeOrder, memberRole, nextHomeStep, ONBOARDING_MATCHES, overviewPathFor, saysWhatTheyWant } from './role-home';

it('names only the next unfinished step once its profile and connections are known', () => {
  const steps = [{ done: true, key: 'one' }, { done: false, key: 'two' }, { done: false, key: 'three' }];
  expect(nextHomeStep(steps, false)).toBeUndefined();
  expect(nextHomeStep(steps, true)).toBe(steps[1]);
  expect(nextHomeStep(steps.slice(0, 1), true)).toBeUndefined();
  expect(ONBOARDING_MATCHES.mentor.en).not.toBe(ONBOARDING_MATCHES.investor.en);
});

describe('the first page for each kind of member', () => {
  it('sorts roles the way their dashboards do', () => {
    expect(homeAudience('existing_founder')).toBe('founder');
    expect(homeAudience('coach')).toBe('mentor');
    expect(homeAudience('course_creator')).toBe('mentor');
    expect(homeAudience('vc_analyst')).toBe('investor');
    expect(homeAudience('recruiter')).toBe('provider');
    expect(homeAudience('university_admin')).toBe('org');
    expect(homeAudience(null)).toBe('founder');
  });

  it('reads the role chosen at registration when the account has no facet', () => {
    expect(homeAudience(memberRole('aspiring_founder', 'investor'))).toBe('investor');
    expect(homeAudience(memberRole('aspiring_founder', 'mentor'))).toBe('mentor');
    expect(homeAudience(memberRole('aspiring_founder', 'org'))).toBe('org');
    expect(overviewPathFor(memberRole('aspiring_founder', 'investor'))).toBe('/dashboard/investor');
    expect(homeAudience(memberRole('aspiring_founder', 'founder'))).toBe('founder');
    expect(homeAudience(memberRole('aspiring_founder', null))).toBe('founder');
  });

  it('prefers a role facet when there is one', () => {
    expect(homeAudience(memberRole('vc_scout', 'founder'))).toBe('investor');
  });

  it('leads each role to its own Overview', () => {
    expect(overviewPathFor('technical_talent')).toBe('/dashboard/founder');
    expect(overviewPathFor('course_creator')).toBe('/dashboard/mentor');
    expect(overviewPathFor('angel_investor')).toBe('/dashboard/investor');
    expect(overviewPathFor('legal_partner')).toBe('/dashboard/provider');
    expect(overviewPathFor('accelerator_admin')).toBe('/dashboard/incubator');
    expect(overviewPathFor('platform_admin')).toBe('/admin/dashboard');
  });

  it('has a sentence and a first step for every audience', () => {
    for (const copy of Object.values(HOME_COPY)) {
      expect(copy.title.en && copy.title.el && copy.description.el && copy.want.el).toBeTruthy();
    }
  });

  it('reads the first step from the field profile edit saves', () => {
    expect(saysWhatTheyWant('founder', { rolePayload: { rolesSought: ['Technical co-founder'] } })).toBe(true);
    expect(saysWhatTheyWant('mentor', { rolePayload: { expertiseAreas: ['Growth'] } })).toBe(true);
    expect(saysWhatTheyWant('investor', { rolePayload: { stages: ['seed'] } })).toBe(true);
    expect(saysWhatTheyWant('provider', { skills: [{ skillName: 'Legal' }] })).toBe(true);
    expect(saysWhatTheyWant('org', { rolePayload: { organizationType: 'accelerator' } })).toBe(true);
  });

  it('does not count an empty answer', () => {
    expect(saysWhatTheyWant('mentor', { rolePayload: { expertiseAreas: [] } })).toBe(false);
    expect(saysWhatTheyWant('investor', { rolePayload: { investmentFocus: [''] } })).toBe(false);
    expect(saysWhatTheyWant('provider', { skills: [] })).toBe(false);
    expect(saysWhatTheyWant('org', null)).toBe(false);
  });
});

describe('homeOrder', () => {
  it('keeps the steps after the people while the page reads', () => {
    expect(homeOrder({ loading: true, peopleCount: 0, showSteps: true }).stepsFirst).toBe(false);
  });

  it('leads with the steps for an account that has nothing yet', () => {
    const out = homeOrder({ loading: false, peopleCount: 0, showSteps: true });
    expect(out.stepsFirst).toBe(true);
    expect(out.peopleEmptyButton).toBe(false);
  });

  it('keeps the people first when they exist', () => {
    expect(homeOrder({ loading: false, peopleCount: 3, showSteps: true }).stepsFirst).toBe(false);
  });

  it('keeps its one-way-in when the steps are done or not wanted', () => {
    const out = homeOrder({ loading: false, peopleCount: 0, showSteps: false });
    expect(out.stepsFirst).toBe(false);
    expect(out.peopleEmptyButton).toBe(true);
  });
});
