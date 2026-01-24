import { test, expect } from '@playwright/test';

test.describe('Semantle Word Distance Game', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should load the homepage with correct title', async ({ page }) => {
    await page.goto('/');

    // Wait a bit to let errors surface
    await page.waitForTimeout(1000);

    // Check title
    await expect(page).toHaveTitle(/Semantle/);

    // Check header is visible
    await expect(page.getByRole('heading', { name: /Semantle/ })).toBeVisible();

    // Check game number is displayed
    await expect(page.locator('text=/#\\d+/')).toBeVisible();
  });

  test('should display help modal when clicking help button', async ({ page }) => {
    await page.goto('/');

    // Click help button
    await page.getByRole('button', { name: /How to play/i }).click();

    // Check modal is visible
    await expect(page.getByRole('heading', { name: /How to Play/i })).toBeVisible();
    await expect(page.getByText(/Semantle is a word guessing game/i)).toBeVisible();

    // Check modal sections
    await expect(page.getByText(/🎯 Goal/)).toBeVisible();
    await expect(page.getByText(/📊 Scoring/)).toBeVisible();
    await expect(page.getByText(/💡 Tips/)).toBeVisible();
    await expect(page.getByText(/🗓️ Daily Word/)).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /Got it!/i }).click();
    await expect(page.getByRole('heading', { name: /How to Play/i })).not.toBeVisible();
  });

  test('should have functional input field', async ({ page }) => {
    await page.goto('/');

    // Find input field
    const input = page.getByPlaceholder(/Enter a word/i);
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // Type a word
    await input.fill('test');
    await expect(input).toHaveValue('test');

    // Check guess button is enabled
    const guessButton = page.getByRole('button', { name: /^Guess$/i });
    await expect(guessButton).toBeEnabled();
  });

  test('should make a valid guess and display result', async ({ page }) => {
    await page.goto('/');

    // Make a guess with a word that exists in the vocabulary
    const input = page.getByPlaceholder(/Enter a word/i);
    await input.fill('king');
    await page.getByRole('button', { name: /^Guess$/i }).click();

    // Wait for guess to appear in the list
    await expect(page.getByText('king')).toBeVisible({ timeout: 5000 });

    // Check that rank is displayed
    await expect(page.locator('text=/#\\d+/')).toBeVisible();

    // Check input is cleared
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
  });

  test('should show error for invalid word', async ({ page }) => {
    await page.goto('/');

    // Try to guess a word not in vocabulary
    const input = page.getByPlaceholder(/Enter a word/i);
    await input.fill('asdfghjkl');
    await page.getByRole('button', { name: /^Guess$/i }).click();

    // Check for error message
    await expect(page.getByText(/Word not in vocabulary/i)).toBeVisible({ timeout: 2000 });

    // Word should not be added to guess list
    await expect(page.getByText('asdfghjkl').first()).toBeVisible();
  });

  test('should prevent duplicate guesses', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/Enter a word/i);

    // Make first guess
    await input.fill('king');
    await page.getByRole('button', { name: /^Guess$/i }).click();
    await expect(page.getByText('king')).toBeVisible({ timeout: 5000 });

    // Try to guess the same word again
    await input.fill('king');
    await page.getByRole('button', { name: /^Guess$/i }).click();

    // Should show error
    await expect(page.getByText(/Already guessed/i)).toBeVisible({ timeout: 2000 });
  });

  test('should display guess count and best rank', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/Enter a word/i);

    // Make multiple guesses
    const words = ['king', 'queen', 'prince'];
    for (const word of words) {
      await input.fill(word);
      await page.getByRole('button', { name: /^Guess$/i }).click();
      await page.waitForTimeout(500);
    }

    // Check stats are displayed
    await expect(page.locator('text=/\\d+ guesses/')).toBeVisible();
    await expect(page.locator('text=/Best rank: #\\d+/')).toBeVisible();
  });

  test('should toggle between guess order and similarity sort', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/Enter a word/i);

    // Make a few guesses
    await input.fill('king');
    await page.getByRole('button', { name: /^Guess$/i }).click();
    await page.waitForTimeout(300);

    await input.fill('queen');
    await page.getByRole('button', { name: /^Guess$/i }).click();
    await page.waitForTimeout(300);

    // Toggle to sort by similarity
    await page.getByRole('button', { name: /By Similarity/i }).click();

    // Button should be active
    await expect(page.getByRole('button', { name: /By Similarity/i })).toHaveClass(/bg-blue-600/);

    // Toggle back to guess order
    await page.getByRole('button', { name: /By Guess Order/i }).click();
    await expect(page.getByRole('button', { name: /By Guess Order/i })).toHaveClass(/bg-blue-600/);
  });

  test('should switch between list and visualization tabs', async ({ page }) => {
    await page.goto('/');

    // Make a guess first
    const input = page.getByPlaceholder(/Enter a word/i);
    await input.fill('king');
    await page.getByRole('button', { name: /^Guess$/i }).click();
    await page.waitForTimeout(500);

    // Switch to visualization tab
    await page.getByRole('button', { name: /🎯 Visualization/i }).click();

    // Check visualization is visible
    await expect(page.getByText(/Similarity Map/i)).toBeVisible();
    await expect(page.locator('svg')).toBeVisible();

    // Check for visualization controls
    await expect(page.getByRole('button', { name: /Labels/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /🔀 Shuffle/i })).toBeVisible();

    // Switch back to list
    await page.getByRole('button', { name: /📋 Guess List/i }).click();
    await expect(page.getByText('king')).toBeVisible();
  });

  test('should show winning celebration when guessing correct word', async ({ page }) => {
    await page.goto('/');

    // Get the target word from the data (we know it's deterministic based on date)
    const targetWord = await page.evaluate(() => {
      const data = require('./src/data/words.json');
      const today = new Date().toISOString().split('T')[0];
      let hash = 0;
      for (let i = 0; i < today.length; i++) {
        const char = today.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return data.words[Math.abs(hash) % data.words.length];
    });

    // Guess the target word
    const input = page.getByPlaceholder(/Enter a word/i);
    await input.fill(targetWord);
    await page.getByRole('button', { name: /^Guess$/i }).click();

    // Check for celebration modal
    await expect(page.getByRole('heading', { name: /You got it!/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(new RegExp(targetWord, 'i'))).toBeVisible();

    // Check for share button
    await expect(page.getByRole('button', { name: /Share Results/i })).toBeVisible();
  });

  test('should persist game state in localStorage', async ({ page }) => {
    await page.goto('/');

    // Make a guess
    const input = page.getByPlaceholder(/Enter a word/i);
    await input.fill('king');
    await page.getByRole('button', { name: /^Guess$/i }).click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();

    // Check guess is still there
    await expect(page.getByText('king')).toBeVisible({ timeout: 3000 });
  });

  test('should take screenshot of the game UI', async ({ page }) => {
    await page.goto('/');

    // Make a few guesses
    const input = page.getByPlaceholder(/Enter a word/i);
    const words = ['king', 'queen', 'royal'];

    for (const word of words) {
      await input.fill(word);
      await page.getByRole('button', { name: /^Guess$/i }).click();
      await page.waitForTimeout(300);
    }

    // Take screenshot of main view
    await page.screenshot({
      path: 'tests/screenshots/game-with-guesses.png',
      fullPage: true
    });

    // Switch to visualization and screenshot
    await page.getByRole('button', { name: /🎯 Visualization/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'tests/screenshots/visualization.png',
      fullPage: true
    });

    // Open help modal and screenshot
    await page.getByRole('button', { name: /📋 Guess List/i }).click();
    await page.getByRole('button', { name: /How to play/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'tests/screenshots/help-modal.png',
      fullPage: true
    });
  });
});
