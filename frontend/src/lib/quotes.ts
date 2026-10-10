/**
 * Personal quotes, motivations, and sayings for the admin greeting.
 * Each entry is shown randomly when the admin hub loads.
 * Add, remove, or edit freely — this is your personal corner.
 */

export interface Quote {
  text: string
  /** Optional attribution — leave empty for personal/original sayings */
  author?: string
  /** Optional tag for filtering in the future */
  tag?: 'motivation' | 'markets' | 'personal' | 'wisdom' | 'builder'
}

export const quotes: Quote[] = [
  // ─── Markets & Investing ───
  {
    text: "The stock market is a device for transferring money from the impatient to the patient.",
    author: "Warren Buffett",
    tag: "markets",
  },
  {
    text: "In investing, what is comfortable is rarely profitable.",
    author: "Robert Arnott",
    tag: "markets",
  },
  {
    text: "The goal isn't more money. The goal is living life on your terms.",
    tag: "markets",
  },
  {
    text: "Risk comes from not knowing what you're doing.",
    author: "Warren Buffett",
    tag: "markets",
  },
  {
    text: "Buy when there's blood in the streets, even if the blood is your own.",
    author: "Baron Rothschild",
    tag: "markets",
  },
  {
    text: "The market can stay irrational longer than you can stay solvent.",
    author: "John Maynard Keynes",
    tag: "markets",
  },

  // ─── Builder & Craft ───
  {
    text: "Ship it. Learn from it. Ship again.",
    tag: "builder",
  },
  {
    text: "You don't rise to the level of your goals. You fall to the level of your systems.",
    author: "James Clear",
    tag: "builder",
  },
  {
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    tag: "builder",
  },
  {
    text: "Make it work, make it right, make it fast.",
    author: "Kent Beck",
    tag: "builder",
  },
  {
    text: "Done is better than perfect.",
    tag: "builder",
  },
  {
    text: "First, solve the problem. Then, write the code.",
    author: "John Johnson",
    tag: "builder",
  },

  // ─── Personal & Wisdom ───
  {
    text: "Your edge is consistency. Everyone else gives up.",
    tag: "personal",
  },
  {
    text: "Discipline is choosing between what you want now and what you want most.",
    author: "Abraham Lincoln",
    tag: "wisdom",
  },
  {
    text: "Small daily improvements over time lead to stunning results.",
    tag: "personal",
  },
  {
    text: "The compound effect is real — in money, code, and habits.",
    tag: "personal",
  },
  {
    text: "Trust the process. The signals are there if you're patient.",
    tag: "personal",
  },
  {
    text: "You built this. Remember that on the hard days.",
    tag: "personal",
  },
  {
    text: "Stay hungry, stay foolish.",
    author: "Steve Jobs",
    tag: "motivation",
  },

  // ─── Motivation ───
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    tag: "motivation",
  },
  {
    text: "Every expert was once a beginner.",
    tag: "motivation",
  },
  {
    text: "Hard choices, easy life. Easy choices, hard life.",
    author: "Jerzy Gregorek",
    tag: "motivation",
  },
  {
    text: "What you do today can improve all your tomorrows.",
    tag: "motivation",
  },
  {
    text: "The pain you feel today is the strength you feel tomorrow.",
    tag: "motivation",
  },
  {
    text: "Opportunities don't happen. You create them.",
    tag: "motivation",
  },
]

/**
 * Get a deterministic-ish quote based on the current day.
 * Same quote all day, new one tomorrow.
 */
export function getDailyQuote(): Quote {
  const today = new Date()
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  return quotes[dayOfYear % quotes.length]
}

/**
 * Get a random quote (different on each page load).
 */
export function getRandomQuote(): Quote {
  return quotes[Math.floor(Math.random() * quotes.length)]
}
