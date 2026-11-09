import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  path.resolve(process.cwd(), '.github/workflows/supabase-migrations.yml'),
  'utf8',
);

const backupWorkflow = readFileSync(
  path.resolve(process.cwd(), '.github/workflows/production-backup.yml'),
  'utf8',
);

describe('production release workflow', () => {
  it('uses the official GHCR mirror for production backup image downloads', () => {
    expect(backupWorkflow).toMatch(
      /SUPABASE_INTERNAL_IMAGE_REGISTRY:\s*ghcr\.io/u,
    );
    expect(backupWorkflow).toContain('run: make supabase-prod-backup');
    expect(backupWorkflow).toContain('run: make backup-encrypt');
  });

  it('disables automatic main deployments while keeping deploy hooks and previews available', () => {
    const configurationPath = path.resolve(process.cwd(), 'vercel.json');
    const configuration = existsSync(configurationPath)
      ? JSON.parse(readFileSync(configurationPath, 'utf8'))
      : {};
    const branches = configuration.git?.deploymentEnabled;

    expect(branches?.main).toBe(false);
    expect(branches?.dev ?? branches?.['*'] ?? true).toBe(true);
    expect(configuration.github?.enabled).not.toBe(false);
  });

  it('deploys only after migrations and refuses to deploy a superseded SHA', () => {
    const deploymentJob = workflow.slice(
      workflow.indexOf('  deploy-production:'),
      workflow.indexOf('  report-failure:'),
    );

    expect(deploymentJob).toContain('needs: migrate-production');
    expect(deploymentJob).not.toContain('schedule');
    expect(deploymentJob).toContain('VERCEL_TOKEN');
    expect(deploymentJob).toContain('inputs.expected_sha');
    expect(deploymentJob).toContain('run: make production-release');
    expect(deploymentJob).toContain('timeout-minutes: 15');
  });

  it('requires an explicit SHA and never publishes from a CI completion or schedule', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toMatch(
      /expected_sha:\s*\n\s*description:[^\n]*\n\s*required: true/u,
    );
    expect(workflow).toContain('request_id:');
    expect(workflow).toContain('run-name:');
    expect(workflow).not.toContain('workflow_run');
    expect(workflow).not.toContain('schedule:');
    expect(workflow).not.toContain('audit-production-migrations');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(backupWorkflow).toContain("cron: '17 3 * * *'");
  });

  it('reports production release failures', () => {
    const failureJob = workflow.slice(workflow.indexOf('  report-failure:'));

    expect(failureJob).toContain('- deploy-production');
    expect(failureJob).toContain('- migrate-production');
    expect(failureJob).toContain(
      "if: always() && contains(needs.*.result, 'failure')",
    );
    expect(failureJob).toContain('pipeline-failure');
  });
});
