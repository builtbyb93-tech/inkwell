import { releaseConfiguration } from '@inkwell/operations';
try {
  console.log(JSON.stringify(releaseConfiguration(process.env)));
} catch {
  console.error(
    'Release configuration is incomplete or unsafe. Use the environment template and approved runbook; no values are printed and no deployment was activated.',
  );
  process.exitCode = 1;
}
