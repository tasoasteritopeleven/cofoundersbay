import { describe, expect, it } from 'vitest';
import {
  appendDocCitation,
  appendDocDate,
  appendDocLink,
  appendPlainText,
  applyDocFormat,
  countDocWords,
  findReplaceDoc,
  mergeDocHtml,
  splitDocBlocks,
} from './canvas-document';

describe('applyDocFormat', () => {
  it('wraps and unwraps bold, and turns lines into a list', () => {
    expect(applyDocFormat('hello', 'bold')).toBe('<strong>hello</strong>');
    expect(applyDocFormat('<strong>hello</strong>', 'bold')).toBe('hello');
    expect(applyDocFormat('one\ntwo', 'bullet')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(applyDocFormat('code', 'code')).toBe('<pre>code</pre>');
    expect(applyDocFormat('hello', 'align_center')).toBe('<div class="text-center">hello</div>');
    expect(applyDocFormat('hello', 'indent')).toBe('<div class="pl-6">hello</div>');
  });
});

describe('count / replace / citation', () => {
  it('counts words, replaces in place, and appends a cite', () => {
    expect(countDocWords('<p>Hello <em>there</em> world</p>')).toEqual({ words: 3, chars: 17 });
    expect(findReplaceDoc('<p>price</p>', 'price', 'pricing')).toBe('<p>pricing</p>');
    expect(findReplaceDoc('<p>price</p>', 'p', 'q')).toBe('<p>qrice</p>');
    expect(appendDocCitation('body', 'Porter 2008')).toContain('<cite>Porter 2008</cite>');
    expect(appendDocLink('', 'https://example.com', 'Source')).toContain('href="https://example.com"');
  });
});

describe('merge / split / date / paste', () => {
  it('joins notes, splits paragraphs, stamps a date, and pastes plain', () => {
    expect(mergeDocHtml(['<p>a</p>', '<p>b</p>'])).toBe('<p>a</p><p>b</p>');
    expect(splitDocBlocks('<p>one</p><p>two</p>')).toEqual(['<p>one</p>', '<p>two</p>']);
    expect(appendDocDate('body', '2026-09-17')).toContain('<time datetime="2026-09-17">2026-09-17</time>');
    expect(appendPlainText('<p>a</p>', 'plain')).toBe('<p>a</p><p>plain</p>');
  });
});
