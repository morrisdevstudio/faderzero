import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DEFAULT_EVIDENCE_PATH = new URL('../docs/reports/EPIC_10_OBSERVATION.json', import.meta.url);

function elapsedDays(from, to) {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;
  return Math.floor((end - start) / 86_400_000);
}

export function evaluateEpic10Gate(evidence) {
  const failures = [];
  const minimumDays = evidence.minimumDays ?? 30;
  const minimumVersions = evidence.minimumVersions ?? 2;
  const versions = Array.isArray(evidence.compatibleVersions) ? evidence.compatibleVersions : [];
  const distinctVersions = new Set(versions.map(({ version }) => version).filter(Boolean));

  if (distinctVersions.size < minimumVersions) {
    failures.push(`${minimumVersions} versions compatibles distinctes requises (${distinctVersions.size} observée(s))`);
  }

  const observationDays = elapsedDays(evidence.observationStartedAt, evidence.observedAt);
  if (!Number.isFinite(observationDays) || observationDays < minimumDays) {
    failures.push(`${minimumDays} jours complets d'observation requis (${Number.isFinite(observationDays) ? observationDays : 0} observé(s))`);
  }

  const zeroMetrics = [
    ['activeLegacyClients', 'ancien client actif'],
    ['unobservedKnownClients', 'client connu non observé'],
    ['clientsRequiringRecovery', 'client nécessitant une récupération'],
    ['unresolvedRecoveryItems', 'élément local en récupération'],
    ['unresolvedQuarantineItems', 'élément en quarantaine'],
  ];

  for (const [field, label] of zeroMetrics) {
    if (!Number.isInteger(evidence[field]) || evidence[field] !== 0) {
      failures.push(`aucun ${label} requis (${evidence[field] ?? 'preuve absente'})`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    distinctVersions: distinctVersions.size,
    observationDays: Number.isFinite(observationDays) ? observationDays : 0,
  };
}

async function main() {
  const evidencePath = process.argv[2] ? new URL(`file:///${process.argv[2].replaceAll('\\', '/')}`) : DEFAULT_EVIDENCE_PATH;
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  const result = evaluateEpic10Gate(evidence);

  if (!result.passed) {
    console.error('EPIC 10 GATE: BLOQUÉ');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`EPIC 10 GATE: OUVERT (${result.distinctVersions} versions, ${result.observationDays} jours)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
