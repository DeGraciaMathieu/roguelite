import { describe, expect, it } from 'vitest';
import { META_VERSION, defaultMeta } from '@/domain';
import { HANDGUN_ID } from '@/data/weapons';
import { createMetaStorage } from './metaStorage';
import type { KeyValueStorage } from './metaStorage';

function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    dump: () => Object.fromEntries(data),
  };
}

describe('createMetaStorage', () => {
  it('retourne les défauts quand rien n’est stocké', () => {
    const storage = createMetaStorage(fakeStorage(), HANDGUN_ID);
    expect(storage.load()).toEqual(defaultMeta(HANDGUN_ID));
  });

  it('fait un aller-retour save/load fidèle', () => {
    const storage = createMetaStorage(fakeStorage(), HANDGUN_ID);
    const meta = { ...defaultMeta(HANDGUN_ID), currency: 320 };
    meta.records.totalRuns = 7;

    storage.save(meta);

    expect(storage.load()).toEqual(meta);
  });

  it('repart des défauts sur un blob JSON corrompu', () => {
    const storage = createMetaStorage(fakeStorage({ 'dinocrisis.meta': '{pas du json' }), HANDGUN_ID);
    expect(storage.load()).toEqual(defaultMeta(HANDGUN_ID));
  });

  it('repart des défauts sur une version inconnue', () => {
    const blob = JSON.stringify({ version: META_VERSION + 999, data: { currency: 9999 } });
    const storage = createMetaStorage(fakeStorage({ 'dinocrisis.meta': blob }), HANDGUN_ID);
    expect(storage.load()).toEqual(defaultMeta(HANDGUN_ID));
  });

  it('sérialise sous forme versionnée', () => {
    const fake = fakeStorage();
    const storage = createMetaStorage(fake, HANDGUN_ID);

    storage.save(defaultMeta(HANDGUN_ID));

    const written = JSON.parse(fake.dump()['dinocrisis.meta'] ?? 'null') as { version: number };
    expect(written.version).toBe(META_VERSION);
  });
});
