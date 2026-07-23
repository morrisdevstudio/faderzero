import { beforeEach, describe, expect, it, vi } from 'vitest';

const { channel, channelFactory, removeChannel } = vi.hoisted(() => {
  const hoistedChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  return {
    channel: hoistedChannel,
    channelFactory: vi.fn(() => hoistedChannel),
    removeChannel: vi.fn(),
  };
});

channel.on.mockImplementation(() => channel);
channel.subscribe.mockImplementation(() => channel);

vi.mock('./client', () => ({
  supabase: {
    channel: channelFactory,
    removeChannel,
  },
}));

vi.mock('./auth', () => ({
  getSession: vi.fn(async () => null),
}));

import { subscribeToWorkspaceChanges } from './realtime';

describe('subscribeToWorkspaceChanges', () => {
  beforeEach(() => {
    channel.on.mockClear();
    channel.subscribe.mockClear();
    channelFactory.mockClear();
    removeChannel.mockClear();
  });

  it('registers an explicit filtered subscription for every synchronized table', () => {
    subscribeToWorkspaceChanges('workspace-1', vi.fn());

    expect(channelFactory).toHaveBeenCalledWith('workspace:workspace-1');
    expect(channel.on).toHaveBeenCalledTimes(5);
    expect(channel.on.mock.calls.map((call) => call[1])).toEqual([
      { event: '*', schema: 'public', table: 'songs', filter: 'workspace_id=eq.workspace-1' },
      { event: '*', schema: 'public', table: 'setlists', filter: 'workspace_id=eq.workspace-1' },
      { event: '*', schema: 'public', table: 'setlist_songs', filter: 'workspace_id=eq.workspace-1' },
      { event: '*', schema: 'public', table: 'song_assets', filter: 'workspace_id=eq.workspace-1' },
      { event: '*', schema: 'public', table: 'events', filter: 'workspace_id=eq.workspace-1' },
    ]);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it('removes the shared channel on unsubscribe', () => {
    const subscription = subscribeToWorkspaceChanges('workspace-1', vi.fn());

    subscription.unsubscribe();

    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
