import { expect, it } from 'vitest';
import { clearlyLocalRequest, directWeatherRequest } from './request-routing';

it('skips planning only for clear local tasks and preserves current-information routing', () => {
  for (const question of ['What is the capital of Oklahoma?', 'Write a limerick about a cat', 'Explain photosynthesis']) expect(clearlyLocalRequest(question)).toBe(true);
  for (const question of ['Write a report on the current election', 'Write a report on Apple', 'What is the capital of Oklahoma today?', 'Can you check the external situation?']) expect(clearlyLocalRequest(question)).toBe(false);
  expect(directWeatherRequest('What is the weather in Tulsa, OK right now?')).toBe(true);
  for (const question of ['Search for Tulsa weather news', 'Compare Tulsa weather with London', 'Tulsa weather last week']) expect(directWeatherRequest(question)).toBe(false);
});
