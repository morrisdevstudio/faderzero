import { expect, test } from '@playwright/test';

test('affiche l’écran de connexion sans session', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});
