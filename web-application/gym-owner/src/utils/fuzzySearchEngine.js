/**
 * fuzzySearchEngine.js (Gym Owner Frontend SSOT)
 * Damerau-Levenshtein distance, tokenization, typo tolerance,
 * and multi-field scoring aligned with doc/GYM_DISCOVERY_INFINITE_SCROLL_AND_SEEDING_SPECIFICATION.md
 */

// Canonical Chennai Localities Vocabulary
export const CHENNAI_LOCALITIES_VOCAB = [
  'Anna Nagar', 'T. Nagar', 'Nungambakkam', 'Alwarpet', 'Mylapore', 'Kilpauk',
  'Chetpet', 'Shenoy Nagar', 'Egmore', 'Royapettah', 'Gopalapuram', 'Triplicane',
  'Teynampet', 'Nandanam', 'Choolaimedu', 'Adyar', 'Besant Nagar', 'Thiruvanmiyur',
  'R.A. Puram', 'Mandaveli', 'Kotturpuram', 'Saidapet', 'Guindy', 'Velachery',
  'Madipakkam', 'Keelkattalai', 'Pallikaranai', 'Medavakkam', 'Kovilambakkam',
  'Nanmangalam', 'Sembakkam', 'Selaiyur', 'Chitlapakkam', 'Taramani', 'Kandanchavadi',
  'Perungudi', 'Thoraipakkam', 'Karapakkam', 'Sholinganallur', 'Semmancheri',
  'Navalur', 'Siruseri', 'Kelambakkam', 'Kottivakkam', 'Palavakkam', 'Neelankarai',
  'Injambakkam', 'Akkarai', 'Panaiyur', 'Uthandi', 'Kanathur', 'Muttukadu',
  'Kovalam', 'Vadapalani', 'Ashok Nagar', 'K.K. Nagar', 'Virugambakkam', 'Saligramam',
  'Valasaravakkam', 'Ramapuram', 'Porur', 'Iyyappanthangal', 'Mangadu',
  'Poonamallee', 'Kumananchavadi', 'Manapakkam', 'Nandambakkam', 'Gerugambakkam',
  'Kundrathur', 'Thirumazhisai', 'Karambakkam', 'Mugalivakkam', 'Alapakkam',
  'Mogappair East', 'Mogappair West', 'Nolambur', 'Ambattur', 'Ambattur Industrial Estate',
  'Padi', 'Korattur', 'Villivakkam', 'Kolathur', 'Perambur', 'Avadi', 'Pattabiram',
  'Thirumullaivoyal', 'Madhavaram', 'Red Hills', 'Puzhal', 'Vyasarpadi', 'Sowcarpet',
  'George Town', 'Royapuram', 'Pallavaram', 'Chromepet', 'Hasthinapuram',
  'East Tambaram', 'West Tambaram', 'Perungalathur', 'Vandalur', 'Urapakkam',
  'Guduvanchery', 'Potheri', 'Tambaram', 'Chennai', 'Tamil Nadu'
];

// Canonical Fitness & Management Vocabulary
export const FITNESS_VOCAB = [
  'Fitness', 'Gym', 'CrossFit', 'Strength', 'Conditioning', 'Bodybuilding',
  'Weightlifting', 'Cardio', 'HIIT', 'Yoga', 'Zumba', 'Pilates', 'Boxing',
  'Kickboxing', 'MMA', 'Martial Arts', 'Aerobics', 'Calisthenics', 'Turf',
  'Steam', 'Sauna', 'Lockers', 'Shower', 'Personal Training', 'Trainer',
  'Coach', 'Olympic', 'Barbell', 'Dumbbell', 'Functional', 'Luxury', 'Elite',
  'Standard', 'Premium', 'Pro', 'Active', 'Expired', 'Cancelled', 'Expiring'
];

const DOMAIN_DICTIONARY = Array.from(new Set([
  ...CHENNAI_LOCALITIES_VOCAB,
  ...FITNESS_VOCAB,
]));

export const damerauLevenshteinDistance = (source, target) => {
  if (!source) return target ? target.length : 0;
  if (!target) return source ? source.length : 0;

  const s = source.toLowerCase();
  const t = target.toLowerCase();

  if (s === t) return 0;

  const m = s.length;
  const n = t.length;
  const maxDist = m + n;

  const charDict = {};
  const matrix = Array.from({ length: m + 2 }, () => Array.from({ length: n + 2 }, () => 0));

  matrix[0][0] = maxDist;
  for (let i = 0; i <= m; i++) {
    matrix[i + 1][0] = maxDist;
    matrix[i + 1][1] = i;
  }
  for (let j = 0; j <= n; j++) {
    matrix[0][j + 1] = maxDist;
    matrix[1][j + 1] = j;
  }

  for (let i = 1; i <= m; i++) {
    let db = 0;
    for (let j = 1; j <= n; j++) {
      const i1 = charDict[t[j - 1]] || 0;
      const j1 = db;
      let cost = 1;
      if (s[i - 1] === t[j - 1]) {
        cost = 0;
        db = j;
      }

      matrix[i + 1][j + 1] = Math.min(
        matrix[i][j + 1] + 1,
        matrix[i + 1][j] + 1,
        matrix[i][j] + cost,
        matrix[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      );
    }
    charDict[s[i - 1]] = i;
  }

  return matrix[m + 1][n + 1];
};

export const tokenizeAndNormalize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

export const isFuzzyMatch = (token, targetWord) => {
  if (!token || !targetWord) return { matched: false, distance: 99, ratio: 0 };

  const tok = token.toLowerCase();
  const tgt = targetWord.toLowerCase();

  if (tgt === tok) return { matched: true, distance: 0, ratio: 1.0 };
  if (tgt.startsWith(tok) || tgt.includes(tok)) {
    return { matched: true, distance: 0, ratio: 0.9 };
  }

  if (tok.length <= 2) {
    return { matched: false, distance: 99, ratio: 0 };
  }

  const maxAllowedDistance = tok.length <= 4 ? 1 : 2;
  const distance = damerauLevenshteinDistance(tok, tgt);

  if (distance <= maxAllowedDistance) {
    const maxLen = Math.max(tok.length, tgt.length);
    const ratio = Math.max(0, 1 - distance / maxLen);
    return { matched: true, distance, ratio };
  }

  return { matched: false, distance, ratio: 0 };
};

export const getDidYouMeanSuggestion = (rawQuery, customDictionary = []) => {
  if (!rawQuery || typeof rawQuery !== 'string') return null;

  const tokens = tokenizeAndNormalize(rawQuery);
  if (tokens.length === 0) return null;

  const dictionary = Array.from(new Set([...DOMAIN_DICTIONARY, ...customDictionary]));
  let hasCorrection = false;
  const correctedTokens = [];

  for (const token of tokens) {
    if (token.length < 3) {
      correctedTokens.push(token);
      continue;
    }

    let exactFound = false;
    for (const term of dictionary) {
      const termWords = tokenizeAndNormalize(term);
      if (termWords.includes(token)) {
        exactFound = true;
        break;
      }
    }

    if (exactFound) {
      correctedTokens.push(token);
      continue;
    }

    let bestCandidate = null;
    let minDistance = 99;

    for (const dictTerm of dictionary) {
      const dictWords = tokenizeAndNormalize(dictTerm);
      for (const word of dictWords) {
        if (Math.abs(word.length - token.length) > 2) continue;

        const maxAllowed = token.length <= 4 ? 1 : 2;
        const dist = damerauLevenshteinDistance(token, word);

        if (dist > 0 && dist <= maxAllowed && dist < minDistance) {
          minDistance = dist;
          bestCandidate = word;
        }
      }
    }

    if (bestCandidate && minDistance <= (token.length <= 4 ? 1 : 2)) {
      correctedTokens.push(bestCandidate);
      hasCorrection = true;
    } else {
      correctedTokens.push(token);
    }
  }

  if (hasCorrection) {
    const joined = correctedTokens.join(' ');
    for (const locality of CHENNAI_LOCALITIES_VOCAB) {
      if (locality.toLowerCase() === joined.toLowerCase()) {
        return locality;
      }
    }
    for (const fit of FITNESS_VOCAB) {
      if (fit.toLowerCase() === joined.toLowerCase()) {
        return fit;
      }
    }
    return correctedTokens
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(' ');
  }

  return null;
};

export default {
  damerauLevenshteinDistance,
  tokenizeAndNormalize,
  isFuzzyMatch,
  getDidYouMeanSuggestion,
};

