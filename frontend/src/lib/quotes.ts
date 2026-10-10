/**
 * Vibrant, empowering quotes, affirmations, and wisdom for the admin greeting.
 * Infused with energetic, lovely, and feminine energy.
 * Each entry is paired with a signature aesthetic emoji.
 */

export interface Quote {
  text: string
  /** Optional attribution — leave empty for personal/original sayings */
  author?: string
  /** Signature lovely emoji */
  emoji?: string
  /** Optional tag for categorization */
  tag?: 'radiance' | 'ambition' | 'wealth' | 'builder' | 'wisdom' | 'energy'
}

export const quotes: Quote[] = [
  // ─── Radiance, Energy & Spark ───
  {
    text: "Energy is your greatest currency. Spend it where it glows.",
    emoji: "✨",
    tag: "radiance",
  },
  {
    text: "The most alluring thing a woman can have is confidence.",
    author: "Beyoncé",
    emoji: "💖",
    tag: "radiance",
  },
  {
    text: "Own your sparkle. The world will adjust its eyes.",
    emoji: "🪄",
    tag: "radiance",
  },
  {
    text: "Be a first-rate version of yourself, not a second-rate version of someone else.",
    author: "Judy Garland",
    emoji: "🌸",
    tag: "radiance",
  },
  {
    text: "Walk in like you own the room, and build it like you own the future.",
    emoji: "💅",
    tag: "energy",
  },
  {
    text: "There is no limit to what we, as women, can accomplish.",
    author: "Michelle Obama",
    emoji: "🌟",
    tag: "energy",
  },
  {
    text: "Bring your full, brilliant self to everything you touch today.",
    emoji: "💫",
    tag: "energy",
  },
  {
    text: "A girl should be two things: who and what she wants.",
    author: "Coco Chanel",
    emoji: "🎀",
    tag: "radiance",
  },
  {
    text: "Electrify your focus. The results will speak louder than any noise.",
    emoji: "⚡",
    tag: "energy",
  },
  {
    text: "Radiate warmth, lead with strength, and execute with absolute clarity.",
    emoji: "☀️",
    tag: "energy",
  },

  // ─── Feminine Ambition & Fearless Vision ───
  {
    text: "I didn't get there by wishing for it or hoping for it, but by working for it.",
    author: "Estée Lauder",
    emoji: "👑",
    tag: "ambition",
  },
  {
    text: "Doubt is a killer. You just have to know who you are and what you stand for.",
    author: "Jennifer Lopez",
    emoji: "🔥",
    tag: "ambition",
  },
  {
    text: "I always did something I was a little not ready to do. That’s how you grow.",
    author: "Marissa Mayer",
    emoji: "🦋",
    tag: "ambition",
  },
  {
    text: "Define success on your own terms, achieve it by your own rules, and build a life you're proud to live.",
    author: "Anne Sweeney",
    emoji: "🎯",
    tag: "ambition",
  },
  {
    text: "Don't be afraid to take up space. You were meant to expand.",
    emoji: "🌺",
    tag: "ambition",
  },
  {
    text: "I wanted to be a woman who designs her own destiny.",
    author: "Diane von Furstenberg",
    emoji: "💃",
    tag: "ambition",
  },
  {
    text: "Think like a queen. A queen is not afraid to fail. Failure is another steppingstone to greatness.",
    author: "Oprah Winfrey",
    emoji: "👑",
    tag: "ambition",
  },
  {
    text: "Never dim your light just because it's shining in someone else's eyes.",
    emoji: "🔮",
    tag: "ambition",
  },
  {
    text: "Courage is like a muscle. We strengthen it by use.",
    author: "Ruth Gordon",
    emoji: "💪",
    tag: "ambition",
  },
  {
    text: "Dreaming, after all, is a form of planning.",
    author: "Gloria Steinem",
    emoji: "🌙",
    tag: "ambition",
  },

  // ─── Intuition, Abundance & Wealth ───
  {
    text: "True abundance is doing what you love with effortless grace and unapologetic excellence.",
    emoji: "💎",
    tag: "wealth",
  },
  {
    text: "Your intuition is your highest alpha. Trust the pattern recognition you've built.",
    emoji: "🕊️",
    tag: "wealth",
  },
  {
    text: "Money looks best when it’s working silently for you while you build what matters.",
    emoji: "🥂",
    tag: "wealth",
  },
  {
    text: "Don't sit down and wait for the opportunities to come. Get up and make them.",
    author: "Madam C.J. Walker",
    emoji: "🚀",
    tag: "wealth",
  },
  {
    text: "High conviction, graceful patience, and decisive timing. That’s the entire game.",
    emoji: "🦢",
    tag: "wealth",
  },
  {
    text: "The market rewards clarity of mind over chaos of action.",
    emoji: "🌿",
    tag: "wealth",
  },
  {
    text: "Invest in your vision, compound your knowledge, and let the numbers follow.",
    emoji: "📈",
    tag: "wealth",
  },
  {
    text: "Financial freedom is the luxury of saying yes only to what sets your soul on fire.",
    emoji: "🌷",
    tag: "wealth",
  },

  // ─── Builder, Precision & Craft ───
  {
    text: "Beauty in code and clarity in architecture — make everything you build feel like art.",
    emoji: "🎨",
    tag: "builder",
  },
  {
    text: "The most dangerous phrase in the language is: 'We’ve always done it this way.'",
    author: "Grace Hopper",
    emoji: "⚡",
    tag: "builder",
  },
  {
    text: "Architecture is really about well-being. It's about creating spaces where people feel inspired.",
    author: "Zaha Hadid",
    emoji: "🏛️",
    tag: "builder",
  },
  {
    text: "Ship it with pride, polish it with care, and never compromise on elegance.",
    emoji: "🪞",
    tag: "builder",
  },
  {
    text: "If you don't take risks, you'll have a wasted soul.",
    author: "Drew Barrymore",
    emoji: "💌",
    tag: "builder",
  },
  {
    text: "Simplicity is the keynote of all true elegance.",
    author: "Coco Chanel",
    emoji: "🕊️",
    tag: "builder",
  },
  {
    text: "You can create something out of nothing if you have the vision and the taste to refine it.",
    author: "Sara Blakely",
    emoji: "💫",
    tag: "builder",
  },
  {
    text: "Craft is love made visible in the smallest UI details.",
    emoji: "🎀",
    tag: "builder",
  },

  // ─── Poise, Self-Love & Inner Wisdom ───
  {
    text: "My mission in life is not merely to survive, but to thrive; and to do so with some passion, some compassion, some humor, and some style.",
    author: "Maya Angelou",
    emoji: "🌺",
    tag: "wisdom",
  },
  {
    text: "Elegance is when the inside is as beautiful as the outside.",
    author: "Coco Chanel",
    emoji: "🌸",
    tag: "wisdom",
  },
  {
    text: "You are the author of your own story. Make it a masterpiece.",
    emoji: "📖",
    tag: "wisdom",
  },
  {
    text: "Above all, be the heroine of your life, not the victim.",
    author: "Nora Ephron",
    emoji: "👑",
    tag: "wisdom",
  },
  {
    text: "Protect your peace, honor your momentum, and celebrate how far you've come.",
    emoji: "☕",
    tag: "wisdom",
  },
  {
    text: "Nothing is impossible, the word itself says 'I'm possible!'",
    author: "Audrey Hepburn",
    emoji: "💖",
    tag: "wisdom",
  },
  {
    text: "Grace under pressure isn't just a virtue — it's an undeniable superpower.",
    emoji: "🦢",
    tag: "wisdom",
  },
  {
    text: "Tell me, what is it you plan to do with your one wild and precious life?",
    author: "Mary Oliver",
    emoji: "✨",
    tag: "wisdom",
  },
  {
    text: "You don't need permission to be extraordinary. You already are.",
    emoji: "🪄",
    tag: "wisdom",
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
