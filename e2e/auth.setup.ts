import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const storageStatePath = path.join('playwright', '.auth', 'user.json');

function requiredEnvironment(name: 'E2E_EMAIL' | 'E2E_PASSWORD') {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured to run authenticated Playwright tests.`);
  return value;
}

test('authenticate the test user and persist the browser state', async ({ page }) => {
  const email = requiredEnvironment('E2E_EMAIL');
  const password = requiredEnvironment('E2E_PASSWORD');

  await page.goto('/');
  // The login heading appears only after the application splash screen has completed.
  const loginHeading = page.getByRole('heading', { name: 'Connexion' });
  await expect(loginHeading).toBeVisible();

  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(loginHeading).not.toBeVisible();

  const workspaceHeading = page.getByRole('heading', { name: 'Vos espaces' });
  if (await workspaceHeading.isVisible()) {
    const workspaceButtons = page.getByRole('button').filter({ hasText: 'Ouvrir' });
    const workspaceCount = await workspaceButtons.count();
    const requestedWorkspace = process.env.E2E_WORKSPACE_NAME;

    if (requestedWorkspace) {
      const requestedButton = workspaceButtons.filter({ hasText: requestedWorkspace });
      await expect(requestedButton).toHaveCount(1, { timeout: 5_000 });
      await requestedButton.click();
    } else if (workspaceCount === 1) {
      await workspaceButtons.first().click();
    } else {
      const availableNames = await workspaceButtons.allTextContents();
      throw new Error(`Multiple workspaces are available. Set E2E_WORKSPACE_NAME to one of: ${availableNames.join(', ')}.`);
    }
  }

  await expect(page.getByLabel(/Changer de groupe/)).toBeVisible();
  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await page.context().storageState({ path: storageStatePath });
});
