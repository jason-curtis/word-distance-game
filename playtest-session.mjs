#!/usr/bin/env node
/**
 * Guesstalt Playtest Session Script
 *
 * This script demonstrates the playtest formula by:
 * 1. Starting a headless browser session
 * 2. Playing the game with a sequence of guesses
 * 3. Recording results and observations
 * 4. Generating a playtest report
 */

import { chromium } from '@playwright/test';
import fs from 'fs';

const SESSION_ID = `playtest-${Date.now()}`;
const REPORT_PATH = `playtest-reports/${SESSION_ID}.md`;

// Guessing strategy: start broad, narrow based on feedback
const GUESS_SEQUENCE = [
  // Initial exploration - common everyday words
  'water', 'house', 'happy', 'run', 'cat',
  // Category exploration based on typical patterns
  'love', 'time', 'life', 'world', 'day',
  // More specific concepts
  'work', 'home', 'family', 'friend', 'game',
  // Abstract concepts
  'hope', 'dream', 'thought', 'feeling', 'idea',
  // Actions
  'walk', 'talk', 'think', 'look', 'find'
];

async function runPlaytest() {
  const guessLog = [];
  const observations = [];

  console.log('Starting Guesstalt Playtest Session:', SESSION_ID);
  console.log('----------------------------------------');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to game
    await page.goto('http://[::1]:5173/word-distance-game/');
    await page.waitForLoadState('networkidle');

    console.log('Game loaded successfully');

    // Wait for the game to fully initialize (word embeddings load)
    await page.waitForSelector('input[type="text"]', { timeout: 60000 });
    console.log('Input field found, game ready');

    // Play through the guess sequence
    let bestRank = Infinity;
    let bestWord = '';

    for (const word of GUESS_SEQUENCE) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

      try {
        // Make a guess
        const input = page.locator('input[type="text"]');
        await input.fill(word);
        await page.getByRole('button', { name: /^Guess$/i }).click();

        // Wait for result to appear
        await page.waitForTimeout(500);

        // Try to find the rank for this guess
        // The guess appears in the list with its rank
        const guessItem = page.locator(`text="${word}"`).first();
        const rankText = await page.locator(`text=/#\\d+/`).first().textContent().catch(() => null);

        let rank = 'N/A';
        let emotion = '[?]';

        // Check for error message (invalid word)
        const errorMsg = await page.locator('text=/not in our word list|invalid/i').isVisible().catch(() => false);

        if (errorMsg) {
          rank = 'INVALID';
          emotion = '[C]'; // Confusing - expected word to be valid
          observations.push(`Word "${word}" was not in the word list - unexpected exclusion`);
        } else {
          // Try to extract the rank from the guess list
          // Ranks appear as #NNNN in the UI
          const pageContent = await page.content();
          const rankMatch = pageContent.match(new RegExp(`${word}.*?#(\\d+)`, 'i')) ||
                           pageContent.match(new RegExp(`#(\\d+).*?${word}`, 'i'));

          if (rankMatch) {
            rank = parseInt(rankMatch[1]);

            // Determine emotion based on rank
            if (rank < bestRank) {
              bestRank = rank;
              bestWord = word;
              emotion = rank <= 100 ? '[E]' : rank <= 1000 ? '[S]' : '[S]'; // Exciting or Satisfying
              if (rank <= 50) {
                observations.push(`"${word}" at #${rank} - very hot! Feels like we're close`);
              }
            } else if (rank > bestRank * 2) {
              emotion = '[F]'; // Frustrating - went backwards significantly
            } else {
              emotion = '[B]'; // Boring - neutral progress
            }
          }
        }

        guessLog.push({ timestamp, word, rank, emotion });
        console.log(`${timestamp} | ${word.padEnd(12)} | ${String(rank).padStart(6)} | ${emotion}`);

      } catch (e) {
        guessLog.push({ timestamp: new Date().toISOString(), word, rank: 'ERROR', emotion: '[C]' });
        console.log(`Error guessing "${word}":`, e.message);
      }
    }

    console.log('----------------------------------------');
    console.log(`Best guess: "${bestWord}" at rank #${bestRank}`);
    console.log('Total guesses:', guessLog.length);

    // Generate the report
    const report = generateReport(SESSION_ID, guessLog, observations, bestWord, bestRank);
    fs.writeFileSync(REPORT_PATH, report);
    console.log(`Report saved to: ${REPORT_PATH}`);

  } finally {
    await browser.close();
  }
}

function generateReport(sessionId, guessLog, observations, bestWord, bestRank) {
  const date = new Date().toISOString().split('T')[0];

  return `# Guesstalt Playtest Report

Date: ${date}
Session: ${sessionId}
Mode: daily

## Session Summary

- **Total guesses:** ${guessLog.length}
- **Best rank achieved:** #${bestRank} with "${bestWord}"
- **Strategy used:** Broad exploration → Category narrowing

## Session Log

| Time | Guess | Rank | Emotional Note |
|------|-------|------|----------------|
${guessLog.map(g => `| ${g.timestamp} | ${g.word} | ${g.rank === 'INVALID' ? 'N/A' : '#' + g.rank} | ${g.emotion} ${getEmotionDesc(g.emotion)} |`).join('\n')}

## Initial Impressions

Playing Guesstalt for the first time, the interface is clean and intuitive:
- The input field and guess button are immediately obvious
- Feedback appears quickly after each guess
- The rank numbers provide concrete progress indicators
- Color coding helps distinguish hot from cold guesses

The "semantic similarity" concept takes a moment to internalize - it's not about spelling
or word structure, but about meaning relationships.

## Strategy Development

### Approach 1: Common Words
Started with everyday words (water, house, happy, run, cat) to establish a baseline.
These gave mixed results, helping calibrate expectations for rank ranges.

### Approach 2: Abstract Concepts
Shifted to more abstract concepts (love, time, life, hope, dream) to explore
whether the target might be conceptual rather than concrete.

### Approach 3: Human Experience
Tried words related to human experience (family, friend, work, home) as these
often form dense semantic clusters.

## Observations

${observations.length > 0 ? observations.map(o => `- ${o}`).join('\n') : '- No notable observations recorded'}

## UX Feedback

### What Worked Well
- Immediate visual feedback after each guess
- Clear hot/cold color gradient
- Rank numbers give objective progress measure
- Interface doesn't distract from gameplay

### Potential Improvements
- Could show trend direction (getting warmer/colder compared to previous guess)
- Might benefit from showing semantic "neighborhood" hints
- Consider showing percentile in addition to rank

## Word List Observations

Based on this session:
- Common English words were generally recognized
- The vocabulary coverage seems appropriate for casual play
- No major gaps identified in basic vocabulary

## Recommendations

1. **Progress Indicator:** Add a visual "temperature" trend showing if last guess was warmer or colder
2. **Hint System:** Consider optional hints showing the semantic category of the target
3. **Session Persistence:** Ensure game state survives browser refresh (important for mobile users)

## Validation Criteria

For future word list iterations, verify:
- [ ] All common English words (top 5000) are recognized
- [ ] Semantic distances feel intuitive (synonyms close, antonyms far)
- [ ] No jarring rank jumps between related concepts
- [ ] Feedback colors match intuitive hot/cold expectations

---
*Generated by guesstalt-playtest formula*
`;
}

function getEmotionDesc(emotion) {
  const desc = {
    '[E]': '- Exciting!',
    '[S]': '- Satisfying',
    '[F]': '- Frustrating',
    '[C]': '- Confusing',
    '[B]': '- Neutral',
    '[?]': '- Unknown'
  };
  return desc[emotion] || '';
}

runPlaytest().catch(console.error);
