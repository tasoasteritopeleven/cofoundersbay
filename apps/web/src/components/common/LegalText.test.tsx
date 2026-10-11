import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LegalText } from './LegalText';

/**
 * /privacy and /terms printed their source verbatim: "**Information You
 * Provide:**" with the asterisks, and bullet characters in a paragraph.
 */
afterEach(cleanup);

describe('LegalText', () => {
  it('renders headings, lists and inline bold without markup characters', () => {
    const { container } = render(
      <LegalText
        content={`We collect:\n\n**Information You Provide:**\n• Account information\n• **Access:** Request a copy of your data`}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Information You Provide' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Access:').tagName).toBe('STRONG');
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('•');
  });

  it('never interprets text as HTML', () => {
    const { container } = render(<LegalText content={'<img src=x onerror=alert(1)>'} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
