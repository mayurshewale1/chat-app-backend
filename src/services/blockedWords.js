/**
 * Blocked/suspicious words filter for messages and user content.
 * Add words via BLOCKED_WORDS_ENV (comma-separated) in .env to extend or override.
 */
// Default list - suspicious/spam/phishing + threat/danger words (lowercase). Add via BLOCKED_WORDS_ENV in .env
const DEFAULT_BLOCKED = [
  'click here to claim', 'verify your account', 'account suspended', 'account locked',
  'send password', 'wire transfer', 'congratulations winner', 'free money',
  'earn money fast', 'investment opportunity', 'crypto investment', 'phishing',
  'bomb', 'bomb threat', 'bombing', 'terrorist', 'terrorism', 'murder', 'kill you',
];

function getBlockedWords() {
  const envList = process.env.BLOCKED_WORDS_ENV;
  if (envList && typeof envList === 'string') {
    return envList
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_BLOCKED;
}

const blockedWords = getBlockedWords();

/**
 * Check if text contains any blocked word (case-insensitive, whole-word or substring).
 * Returns { blocked: boolean, matched?: string }
 */
function containsBlockedWord(text) {
  if (!text || typeof text !== 'string') return { blocked: false };
  const lower = text.toLowerCase().trim();
  for (const word of blockedWords) {
    if (lower.includes(word)) {
      return { blocked: true, matched: word };
    }
  }
  return { blocked: false };
}

/**
 * Validate message content - returns error message if blocked, null if ok.
 */
function validateMessageContent(content) {
  if (!content || typeof content !== 'string') return null;
  const { blocked, matched } = containsBlockedWord(content);
  if (blocked) {
    return 'Message contains content that is not allowed.';
  }
  return null;
}

/**
 * Validate username/display name - returns error message if blocked, null if ok.
 */
function validateUserContent(text) {
  if (!text || typeof text !== 'string') return null;
  const { blocked } = containsBlockedWord(text);
  if (blocked) {
    return 'This name contains words that are not allowed.';
  }
  return null;
}

module.exports = {
  containsBlockedWord,
  validateMessageContent,
  validateUserContent,
  getBlockedWords,
};
