/**
 * Point d'entrée CLI du harnais d'équilibrage (hors build du jeu, lancé via
 * vite-node pour profiter des alias et du TypeScript) :
 *
 *   npm run sim                          # 100 seeds × les deux politiques
 *   npm run sim -- --seeds 500 --policy aggressive
 *   npm run sim -- --start 1000 --seeds 50 --out reports
 *
 * Sortie : résumé console + un JSON (résumés et records) et un CSV (une
 * ligne par run) horodatés dans le dossier de rapports.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCampaign } from './campaign';
import { DEFAULT_MAX_TICKS } from './pilot';
import { AGGRESSIVE_PROFILE, CAUTIOUS_PROFILE } from './policies';
import type { PolicyProfile } from './policies';
import { formatSummaries, summarize, toCsv } from './report';

interface CliOptions {
  seedCount: number;
  firstSeed: number;
  profiles: readonly PolicyProfile[];
  maxTicks: number;
  outDir: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    seedCount: 100,
    firstSeed: 1,
    profiles: [CAUTIOUS_PROFILE, AGGRESSIVE_PROFILE],
    maxTicks: DEFAULT_MAX_TICKS,
    outDir: 'reports',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--seeds':
        options.seedCount = Number(value);
        i += 1;
        break;
      case '--start':
        options.firstSeed = Number(value);
        i += 1;
        break;
      case '--policy': {
        if (value === 'cautious') options.profiles = [CAUTIOUS_PROFILE];
        else if (value === 'aggressive') options.profiles = [AGGRESSIVE_PROFILE];
        else if (value === 'both') options.profiles = [CAUTIOUS_PROFILE, AGGRESSIVE_PROFILE];
        else throw new Error(`--policy attend cautious | aggressive | both, reçu : ${value}`);
        i += 1;
        break;
      }
      case '--max-ticks':
        options.maxTicks = Number(value);
        i += 1;
        break;
      case '--out':
        if (value === undefined) throw new Error('--out attend un dossier');
        options.outDir = value;
        i += 1;
        break;
      case '--':
        break;
      default:
        throw new Error(`Option inconnue : ${flag}`);
    }
  }

  if (!Number.isFinite(options.seedCount) || options.seedCount < 1) {
    throw new Error('--seeds attend un entier ≥ 1');
  }
  if (!Number.isFinite(options.firstSeed)) throw new Error('--start attend un entier');
  if (!Number.isFinite(options.maxTicks) || options.maxTicks < 1) {
    throw new Error('--max-ticks attend un entier ≥ 1');
  }
  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: options.seedCount }, (_, i) => options.firstSeed + i);
  const policyIds = options.profiles.map((profile) => profile.id).join(', ');

  console.log(
    `Campagne : ${options.seedCount} seeds (à partir de ${options.firstSeed}) × [${policyIds}], ` +
      `plafond ${options.maxTicks} ticks/run…`,
  );
  const startedAt = Date.now();
  const records = runCampaign({
    seeds,
    profiles: options.profiles,
    maxTicks: options.maxTicks,
  });
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const summaries = summarize(records);

  console.log('');
  console.log(formatSummaries(summaries));
  console.log(`${records.length} runs simulées en ${elapsedSec} s.`);

  mkdirSync(options.outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `campaign-${stamp}`;
  const jsonPath = join(options.outDir, `${baseName}.json`);
  const csvPath = join(options.outDir, `${baseName}.csv`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        options: {
          seeds: { from: options.firstSeed, count: options.seedCount },
          policies: options.profiles.map((profile) => profile.id),
          maxTicks: options.maxTicks,
        },
        summaries,
        records,
      },
      null,
      2,
    ),
  );
  writeFileSync(csvPath, toCsv(records));
  console.log(`Rapports : ${jsonPath} et ${csvPath}`);
}

main();
