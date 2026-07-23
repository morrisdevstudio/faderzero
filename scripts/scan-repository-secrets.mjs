import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  { name: 'private key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS access key', expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: 'GitHub token', expression: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: 'Slack token', expression: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'Stripe live key', expression: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'Supabase secret key', expression: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
];

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
}).split('\0').filter(Boolean);
const findings = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file);
  } catch {
    continue;
  }

  if (content.includes(0)) {
    continue;
  }

  const text = content.toString('utf8');
  for (const pattern of patterns) {
    if (pattern.expression.test(text)) {
      findings.push(`${file}: possible ${pattern.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Potential secrets detected (values intentionally hidden):');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed for ${files.length} repository files.`);
}
