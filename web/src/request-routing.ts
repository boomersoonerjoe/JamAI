import { needsCurrentInformation } from './search';

// Only unmistakably local work skips the semantic planner. Unknown requests and
// public-topic follow-ups keep planning; explicit web/live intent always wins.
export function clearlyLocalRequest(question: string) {
  if (needsCurrentInformation(question) || /\b(?:latest|recent|today|tomorrow|now|current|this week|this year)\b/i.test(question)) return false;
  return /^(?:what is the capital of [\p{L} .'-]+[?.!]?|(?:please )?(?:write|compose)\b[\s\S]*\b(?:poem|story|limerick|dialogue|fictional|scene|haiku|joke)\b[\s\S]*|(?:please )?(?:rewrite|rephrase|translate|proofread)\b[\s\S]*|(?:please )?(?:explain|describe|define|how does)\b[\s\S]*\b(?:photosynthesis|chlorophyll|gravity|electricity|fractions|multiplication|weather forecasting)\b[\s\S]*|(?:what|which)\b[\s\S]*\b(?:my|our)\b[\s\S]*(?:name|number|favorite|saved|remember)[\s\S]*)$/iu.test(question.trim());
}

export function directWeatherRequest(question: string) {
  return /\bweather\b/i.test(question) && needsCurrentInformation(question) &&
    !/\b(?:search|browse|google|look up|compare|news|article|yesterday|last|next|this week|history|historical|in \d{4})\b/i.test(question);
}
