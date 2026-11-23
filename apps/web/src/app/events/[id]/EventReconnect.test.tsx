import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { EventReconnect, useEventParticipation } from './EventReconnect';
import { getEventAttendance, getEventReconnect, setEventAttendance, setEventReconnect } from '@/lib/event-reconnect-api';
import type { EventItem } from '@/lib/api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useStoredUser', () => ({ useStoredUser: () => ({ id: 'organizer' }) }));
vi.mock('@/components/ui/confirm-dialog', () => ({ useConfirm: () => async () => true }));
vi.mock('@/lib/preview-demo', () => ({ isPreviewDemo: () => false }));
vi.mock('@/lib/event-reconnect-api', () => ({
  getEventAttendance: vi.fn(),
  getEventReconnect: vi.fn(),
  setEventAttendance: vi.fn(),
  setEventReconnect: vi.fn(),
}));

const event = { id: 'event', host: { id: 'organizer' }, viewerRsvp: 'going' } as EventItem;
const person = { userId: 'guest', displayName: 'Guest', avatarUrl: null };

function Page() {
  const participation = useEventParticipation(event);
  return <EventReconnect event={event} participation={participation} />;
}

describe('event reconnect', () => {
  it('uses distinct attendance and private-interest writes, and links to contact only for a mutual match', async () => {
    vi.mocked(getEventAttendance).mockResolvedValue({
      opensAt: '', closesAt: '', editable: true,
      rows: [{ ...person, status: 'going', attended: false }],
    });
    vi.mocked(getEventReconnect).mockResolvedValue({
      state: 'open', closesAt: '2099-01-01',
      rows: [{ ...person, interested: false, mutual: false }],
    });
    vi.mocked(setEventAttendance).mockResolvedValue({ changed: 1 });
    vi.mocked(setEventReconnect).mockImplementation(async () => {
      vi.mocked(getEventReconnect).mockResolvedValue({
        state: 'open', closesAt: '2099-01-01',
        rows: [{ ...person, interested: true, mutual: true }],
      });
      return { interested: true, mutual: true };
    });
    render(<QueryClientProvider client={new QueryClient()}><Page /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Attended: Guest' }));
    await waitFor(() => expect(setEventAttendance).toHaveBeenCalledWith('event', { userId: 'guest', attended: true }));
    expect(screen.queryByRole('link', { name: /Connect or message/ })).toBeNull();
    const interest = await screen.findByRole('button', { name: 'I’d like to meet again: Guest' });
    await waitFor(() => expect(interest.hasAttribute('disabled')).toBe(false));
    fireEvent.click(interest);
    await waitFor(() => expect(setEventReconnect).toHaveBeenCalledWith('event', 'guest', true));
    expect((await screen.findByRole('link', { name: /Connect or message/ })).getAttribute('href')).toBe('/profiles/guest');
  });
});
