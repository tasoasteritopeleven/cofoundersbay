import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RailStats } from './RailParts';

describe('RailStats description list', () => {
  it('keeps each bilingual term and value in a single valid description-list group', () => {
    const { container } = render(
      <RailStats items={[{ key: 'people', label: 'People', labelEl: 'Άτομα', value: 12 }]} />,
    );
    const list = container.querySelector('dl');
    const group = list?.firstElementChild;

    expect(group?.tagName).toBe('DIV');
    expect(group?.querySelectorAll('dt')).toHaveLength(1);
    expect(group?.querySelectorAll('dd')).toHaveLength(1);
    expect(group?.querySelector('dt')?.parentElement).toBe(group);
    expect(group?.querySelector('dd')?.parentElement).toBe(group);
    expect(screen.getByText('People')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });
});