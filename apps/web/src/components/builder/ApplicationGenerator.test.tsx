import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationGenerator } from './ApplicationGenerator';
import { mergeSavedApplications } from './application-model';
import { executeAction } from '@/lib/action-registry';
import { resetPageControlsForTests } from '@/lib/page-controls';

const mocks = vi.hoisted(() => ({ ask: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/contexts/PopupChatContext', () => ({
  usePopupChat: () => ({ ask: mocks.ask }),
  usePopupChatOptional: () => ({ ask: mocks.ask }),
}));
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resetPageControlsForTests();
});
afterEach(cleanup);

const saveCommand = () => executeAction('run_page_command', { control: 'save_applications', value: 'all' });

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('application editing and assistant outcomes', () => {
  it('associates every answer with its visible question, requirement and help', () => {
    render(<ApplicationGenerator hideTitle onSave={vi.fn()} />);
    const questions = mergeSavedApplications(undefined)[0].questions;
    expect(screen.getAllByRole('textbox')).toHaveLength(questions.length);
    for (const question of questions) {
      const field = screen.getByRole('textbox', { name: new RegExp(question.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }) as HTMLTextAreaElement;
      expect(field.required).toBe(question.required);
      if (question.tips) {
        const descriptions = field.getAttribute('aria-describedby')?.split(' ') ?? [];
        expect(descriptions.some((id) => document.getElementById(id)?.textContent?.includes(question.tips!))).toBe(true);
      }
    }
  });

  it('reports an over-limit answer without discarding the existing text', () => {
    const initialData = [{ id: 'yc', questions: [{ id: 'yc1', answer: 'a'.repeat(60) }] }];
    render(<ApplicationGenerator hideTitle initialData={initialData} onSave={vi.fn()} />);
    const field = screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
    expect(field.value).toHaveLength(60);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('does not add demo fundraising facts to an unseeded workspace prompt', () => {
    render(<ApplicationGenerator hideTitle onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Generate/i }));
    const prompt = mocks.ask.mock.calls[0]?.[0];
    expect(prompt).toContain('Y Combinator');
    expect(prompt).not.toMatch(/Harbor|Athens Tech Angels|\$750K|\$375K/);
    expect(prompt).toMatch(/active workspace/i);
  });

  it('waits for storage before reporting a successful AI save', async () => {
    const pending = deferred();
    const onSave = vi.fn(() => pending.promise);
    render(<ApplicationGenerator hideTitle onSave={onSave} />);
    let settled = false;
    let result!: ReturnType<typeof saveCommand>;
    await act(async () => { result = saveCommand(); void result.then(() => { settled = true; }); });
    expect(onSave).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    await act(async () => { pending.resolve(); await result; });
    expect(await result).toEqual({ ok: true });
    expect(mocks.success).toHaveBeenCalledWith('Applications saved', 'Written to the workspace artefact.');
  });

  it('reports a failed AI save instead of a successful action', async () => {
    render(<ApplicationGenerator hideTitle onSave={vi.fn().mockRejectedValue(new Error('Storage unavailable'))} />);
    let outcome;
    await act(async () => { outcome = await saveCommand(); });
    expect(outcome).toMatchObject({ ok: false });
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Could not save');
  });

  it('refuses saves when there is no persistence handler', async () => {
    render(<ApplicationGenerator hideTitle />);
    expect((screen.getByRole('button', { name: /Save All/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(await saveCommand()).toMatchObject({ ok: false });
  });

  it('lets the assistant focus an answer without editing or saving it', async () => {
    const onSave = vi.fn();
    render(<ApplicationGenerator hideTitle onSave={onSave} />);
    let outcome;
    await act(async () => {
      outcome = await executeAction('use_page_control', { control: 'focus_application_question', value: 'yc4' });
    });
    expect(outcome).toEqual({ ok: true });
    expect(document.activeElement).toBe(screen.getAllByRole('textbox')[3]);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps manual edits made while the AI draft is pending', async () => {
    const pending = deferred<{ answers: Record<string, string> }>();
    render(<ApplicationGenerator hideTitle onSave={vi.fn()} onGenerate={() => pending.promise} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Generate/i }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'My own answer' } });
    await act(async () => { pending.resolve({ answers: { yc1: 'AI replacement', yc2: 'AI draft for the empty answer' } }); });
    expect((screen.getAllByRole('textbox')[0] as HTMLTextAreaElement).value).toBe('My own answer');
    expect((screen.getAllByRole('textbox')[1] as HTMLTextAreaElement).value).toBe('AI draft for the empty answer');
  });

  it('navigates between questions without discarding edits or hiding other questions', () => {
    render(<ApplicationGenerator hideTitle onSave={vi.fn()} />);
    const fields = screen.getAllByRole('textbox');
    fireEvent.change(fields[0], { target: { value: 'My own answer' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Go to question/ }), { target: { value: 'yc12' } });
    expect(document.activeElement).toBe(fields[11]);
    expect((fields[0] as HTMLTextAreaElement).value).toBe('My own answer');
    expect(screen.getAllByRole('textbox')).toHaveLength(12);
  });

  it('keeps the submitted state unchanged when recording it fails', async () => {
    const apps = mergeSavedApplications(undefined);
    apps[0].questions = apps[0].questions.map((q) => ({ ...q, answer: 'Answered' }));
    render(<ApplicationGenerator hideTitle initialData={apps} onSave={vi.fn().mockRejectedValue(new Error('Storage unavailable'))} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark.*Submitted/i }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Could not save'));
    expect(screen.getByRole('button', { name: /Mark.*Submitted/i })).toBeTruthy();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
