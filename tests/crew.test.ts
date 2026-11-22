import { describe, expect, it } from 'vitest';
import { channelsFor, isSeverity, isTeam, team, teamContext, TEAMS, TEAM_IDS } from '@/lib/shared/teams';
import { isRenderable } from '@/lib/shared/trust';
import { BS_TYPES, SYSTEM_USER_ID } from '@/lib/shared/types';
import { channelIdFor } from '@/lib/server/rooms';

describe('crew teams', () => {
  it('has unique ids and walkie channel numbers', () => {
    expect(new Set(TEAM_IDS).size).toBe(TEAMS.length);
    expect(new Set(TEAMS.map((t) => t.ch)).size).toBe(TEAMS.length);
    expect(team('control').ch).toBe(1);
  });

  it('show callers hear every channel; crew hear Control plus their own team only', () => {
    expect(channelsFor('lead', 'control')).toEqual(TEAM_IDS);
    expect(channelsFor('crew', 'security')).toEqual(['control', 'security']);
    expect(channelsFor('artist', 'artist')).toEqual(['control', 'artist']);
    // No team yet, or an unknown value, never widens access.
    expect(channelsFor('crew', null)).toEqual(['control']);
    expect(channelsFor('crew', 'everything')).toEqual(['control']);
  });

  it('validates team and severity values', () => {
    expect(isTeam('runners')).toBe(true);
    expect(isTeam('Runners')).toBe(false);
    expect(isSeverity('critical')).toBe(true);
    expect(isSeverity('panic')).toBe(false);
  });

  it('team channel ids are valid Nexconn ids (letters and digits) and distinct per team', () => {
    const ids = TEAM_IDS.map((t) => channelIdFor('team', teamContext('evraahelive', t)));
    ids.forEach((id) => expect(id).toMatch(/^[A-Za-z0-9]{1,64}$/));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('crew cards are server-only', () => {
  it('shows issue/radio cards only from the system sender, but voice clips from anyone', () => {
    expect(isRenderable({ type: BS_TYPES.issue, senderId: SYSTEM_USER_ID })).toBe(true);
    expect(isRenderable({ type: BS_TYPES.issue, senderId: 'someone' })).toBe(false); // forged from devtools
    expect(isRenderable({ type: BS_TYPES.radio, senderId: 'someone' })).toBe(false);
    expect(isRenderable({ type: 'RC:HQVCMsg', senderId: 'someone' })).toBe(true);
  });
});
