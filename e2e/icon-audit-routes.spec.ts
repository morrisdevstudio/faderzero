import { expect, test } from '@playwright/test';

const staticRoutes = [
  { route: '/home', stableHeading: 'Mon Espace' },
  { route: '/calendar', stableHeading: 'Événements' },
  { route: '/booking', stableHeading: 'Contacts' },
  { route: '/songs', stableHeading: 'Morceaux' },
  { route: '/setlists', stableHeading: 'Setlists' },
  { route: '/prompter', stableHeading: 'Prompteur' },
  { route: '/sync', stableHeading: 'Synchronisation Cloud' },
  { route: '/metronome', stableHeading: 'Métronome' },
  { route: '/account', stableHeading: 'Espace personnel' },
] as const;

for (const scenario of staticRoutes) {
  test(`icon audit route ${scenario.route}`, async ({ page }) => {
    await page.goto(scenario.route);
    await expect(page.getByRole('heading', { name: 'Connexion' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: scenario.stableHeading, exact: true })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });
}
