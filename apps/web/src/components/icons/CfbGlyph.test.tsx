import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  CFB_GLYPH_NAMES,
  CfbGlyph,
  CfbGlyphWell,
  glyphForHref,
  glyphForMode,
  NavIcon,
} from './CfbGlyph';
import { Flag } from 'lucide-react';

describe('CoFounderBay original glyph family', () => {
  it('gives every named glyph a unique drawing', () => {
    const drawings = CFB_GLYPH_NAMES.map((name) => {
      const { container } = render(<CfbGlyph name={name} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('focusable')).toBe('false');
      return svg?.innerHTML ?? '';
    });
    expect(new Set(drawings).size).toBe(CFB_GLYPH_NAMES.length);
  });

  it('maps product routes to the matching mark without dropping destinations', () => {
    expect(glyphForHref('/dashboard/founder')).toBe('home');
    expect(glyphForHref('/builder/pitch-deck')).toBe('deck');
    expect(glyphForHref('/builder')).toBe('builder');
    expect(glyphForHref('/readiness')).toBe('gauge');
    expect(glyphForHref('/analytics')).toBe('chart');
    expect(glyphForHref('/investors')).toBe('growth');
    expect(glyphForHref('/builder/applications')).toBe('applications');
    expect(glyphForHref('/matches/compare')).toBe('compare');
    expect(glyphForHref('/settings/ai')).toBe('spark');
    expect(glyphForHref('/expert-reviews')).toBe('award');
    expect(glyphForHref('/pitch/demo')).toBe('deck');
    expect(glyphForHref('/data-room/abc')).toBe('wallet');
    expect(glyphForHref('/feed')).toBe('feed');
    expect(glyphForHref('/ai')).toBe('spark');
    expect(glyphForHref('/messages?tab=ai')).toBe('messages');
    expect(glyphForHref('/unknown-surface')).toBe('default');
    // Search and the Explore mode sit in the same sidebar; one mark for both
    // made the footer's Search button read as a second way into Explore.
    expect(glyphForHref('/search')).toBe('search');
    expect(glyphForHref('/discover')).toBe('discover');
    expect(glyphForMode('work')).toBe('builder');
    expect(glyphForMode('explore')).toBe('discover');
    expect(glyphForMode('account')).toBe('sliders');
  });

  it('prefers a named glyph over a Lucide fallback so navigation stays original', () => {
    const { container, rerender } = render(<NavIcon href="/milestones" fallback={Flag} className="icon-sm" />);
    expect(container.querySelector('svg')?.innerHTML).toContain('M7 20V5.5');
    rerender(<NavIcon fallback={Flag} className="icon-sm" />);
    expect(container.querySelector('svg')).toBeTruthy();
    const well = render(<CfbGlyphWell href="/matches" />);
    expect(well.container.firstElementChild?.className).toContain('rounded-xl');
    expect(well.container.querySelector('svg')).toBeTruthy();
  });
});
