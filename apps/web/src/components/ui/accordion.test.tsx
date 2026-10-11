import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

afterEach(cleanup);

describe('Accordion keyboard and disclosure semantics', () => {
  it('connects each trigger to its region and hides collapsed content', () => {
    render(
      <Accordion>
        <AccordionItem value="overview">
          <AccordionTrigger>Overview</AccordionTrigger>
          <AccordionContent>Founder details</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole('button', { name: 'Overview' });
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.hidden).toBe(true);
    expect(panel?.getAttribute('aria-labelledby')).toBe(trigger.id);

    trigger.focus();
    // Native buttons dispatch clicks for Enter in a browser; jsdom models the
    // disclosure state through the click rather than emulating that default.
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hidden).toBe(false);
    expect(screen.getByRole('region', { name: 'Overview' }).textContent).toContain('Founder details');
    fireEvent.click(trigger);
    expect(panel?.hidden).toBe(true);
  });
});