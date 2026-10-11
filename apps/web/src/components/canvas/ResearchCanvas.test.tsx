import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './ResearchCanvas';

const promptMock = vi.fn<typeof window.prompt>();
const execCommandMock = vi.fn();
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

beforeEach(() => {
  promptMock.mockReset().mockReturnValue(null);
  execCommandMock.mockReset().mockReturnValue(true);
  vi.spyOn(window, 'prompt').mockImplementation(promptMock);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommandMock });
});

afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
  else Reflect.deleteProperty(document, 'execCommand');
});

describe('ResearchCanvas link insertion', () => {
  it('does not prompt during StrictMode rendering or rerendering', () => {
    const onChange = vi.fn();
    const { rerender } = render(<StrictMode><RichTextEditor value="Notes" onChange={onChange} /></StrictMode>);
    rerender(<StrictMode><RichTextEditor value="Updated notes" onChange={onChange} /></StrictMode>);
    expect(promptMock).not.toHaveBeenCalled();
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  it('prompts only on click and restores the selected text after the prompt', () => {
    const onChange = vi.fn();
    const { container } = render(<RichTextEditor value="Research notes" onChange={onChange} />);
    const editor = container.querySelector('[contenteditable]') as HTMLDivElement;
    editor.focus();
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(editor.firstChild!, 0);
    range.setEnd(editor.firstChild!, 8);
    selection.removeAllRanges();
    selection.addRange(range);
    promptMock.mockImplementation(() => {
      selection.removeAllRanges();
      return '  https://example.com/research  ';
    });
    execCommandMock.mockImplementation(() => {
      expect(selection.toString()).toBe('Research');
      return true;
    });
    const button = screen.getByRole('button', { name: 'Insert link. Εισαγωγή συνδέσμου' });
    expect(fireEvent.mouseDown(button)).toBe(false);
    expect(promptMock).not.toHaveBeenCalled();
    expect(execCommandMock).not.toHaveBeenCalled();
    expect(selection.toString()).toBe('Research');
    fireEvent.click(button);
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(execCommandMock).toHaveBeenCalledExactlyOnceWith('createLink', false, 'https://example.com/research');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('Research notes');
  });

  it.each([null, '', '   ', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<h1>test</h1>', ' DATA:text/html,test '])('does not create a link for %j', (url) => {
    const onChange = vi.fn();
    render(<RichTextEditor value="Notes" onChange={onChange} />);
    promptMock.mockReturnValue(url);
    fireEvent.mouseDown(screen.getByTitle('Insert link'));
    fireEvent.click(screen.getByTitle('Insert link'));
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(execCommandMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['https://example.com', '/research', '#notes', 'mailto:test@example.com'])('supports click activation without mouse-down for %s', (url) => {
    render(<RichTextEditor value="Notes" onChange={vi.fn()} />);
    promptMock.mockReturnValue(url);
    fireEvent.click(screen.getByTitle('Insert link'));
    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(execCommandMock).toHaveBeenCalledExactlyOnceWith('createLink', false, url);
  });

  it('hides link insertion in read-only mode', () => {
    render(<RichTextEditor value="Notes" onChange={vi.fn()} readOnly />);
    expect(screen.queryByTitle('Insert link')).toBeNull();
    expect(promptMock).not.toHaveBeenCalled();
  });
});
