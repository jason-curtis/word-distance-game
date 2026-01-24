import { test } from '@playwright/test';

test.describe('Screenshot capture', () => {
  test('capture app screenshots', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Initial state
    await page.screenshot({ path: 'screenshots/01-initial.png', fullPage: true });

    // 2. After making some guesses
    const input = page.getByPlaceholder(/Enter a word/i);
    const guessButton = page.getByRole('button', { name: /^Guess$/i });

    const words = ['king', 'queen', 'prince', 'royal', 'castle'];
    for (const word of words) {
      await input.fill(word);
      await guessButton.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'screenshots/02-with-guesses.png', fullPage: true });

    // 3. Visualization tab
    await page.getByRole('button', { name: /Visualization/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/03-visualization.png', fullPage: true });

    // 4. Back to list view, sorted by similarity
    await page.getByRole('button', { name: /Guess List/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /By Similarity/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshots/04-sorted-by-similarity.png', fullPage: true });

    // 5. Help modal
    await page.getByRole('button', { name: /How to play/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshots/05-help-modal.png', fullPage: true });
  });
});
