import { readFileSync } from 'node:fs';
import { compareVersions, readCurrentVersions, rewritePins } from '../../scripts/sdk-versions.mjs';

const skill = readFileSync(new URL('../../skills/setup-ulink/SKILL.md', import.meta.url), 'utf8');

describe('sdk-versions', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('0.4.3', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('1.2.4', '1.2.4')).toBe(0);
  });

  it('finds exactly one pinned version per SDK in SKILL.md', () => {
    const current = readCurrentVersions(skill);
    for (const version of Object.values(current)) expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('moves every pin of an SDK and leaves other SDKs alone', () => {
    const current = readCurrentVersions(skill);
    const { text, count } = rewritePins(skill, 'android', current.android, '9.9.9');
    expect(count).toBe(2);
    expect(readCurrentVersions(text)).toEqual({ ...current, android: '9.9.9' });
  });

  it('rejects a skill whose pins disagree', () => {
    const current = readCurrentVersions(skill);
    const half = skill.replace(`ly.ulink:ulink-sdk:${current.android}`, 'ly.ulink:ulink-sdk:0.0.1');
    expect(() => readCurrentVersions(half)).toThrow(/expected one android version/);
  });
});
