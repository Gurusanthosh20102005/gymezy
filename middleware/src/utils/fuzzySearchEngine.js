/**
 * fuzzySearchEngine.js
 * High-performance, industry-standard fuzzy search engine with Damerau-Levenshtein
 * typo tolerance, multi-field weighted scoring, and intelligent spelling suggestions.
 */

// Canonical Chennai Localities Vocabulary (Normalized)
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

// Canonical Fitness Vocabulary
export const FITNESS_VOCAB = [
  'Fitness', 'Gym', 'CrossFit', 'Strength', 'Conditioning', 'Bodybuilding',
  'Weightlifting', 'Cardio', 'HIIT', 'Yoga', 'Zumba', 'Pilates', 'Boxing',
  'Kickboxing', 'MMA', 'Martial Arts', 'Aerobics', 'Calisthenics', 'Turf',
  'Steam', 'Sauna', 'Lockers', 'Shower', 'Personal Training', 'Trainer',
  'Coach', 'Olympic', 'Barbell', 'Dumbbell', 'Functional', 'Luxury', 'Elite'
];

// Combine all domain terms for typo correction
const DOMAIN_DICTIONARY = Array.from(new Set([
  ...CHENNAI_LOCALITIES_VOCAB,
  ...FITNESS_VOCAB,
]));

/**
 * Calculates Damerau-Levenshtein distance between two strings,
 * accounting for insertions, deletions, substitutions, and adjacent character transpositions.
 * @param {string} source
 * @param {string} target
 * @returns {number}
 */
export const damerauLevenshteinDistance = (source, target) => {
  if (!source) return target ? target.length : 0;
  if (!target) return source ? source.length : 0;

  const s = source.toLowerCase();
  const t = target.toLowerCase();

  if (s === t) return 0;

  const m = s.length;
  const n = t.length;

  // Maximum possible distance
  const maxDist = m + n;

  // Dictionary for storing the last seen index of characters
  const charDict = {};

  // 2D matrix
  const matrix = Array.from({ length: m + 2 }, () => new Array(n + 2).fill(0));

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
        matrix[i][j + 1] + 1, // deletion
        matrix[i + 1][j] + 1, // insertion
        matrix[i][j] + cost,   // substitution
        matrix[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1) // transposition
      );
    }
    charDict[s[i - 1]] = i;
  }

  return matrix[m + 1][n + 1];
};

/**
 * Splits query string into normalized alphanumeric tokens (filtering empty/stopwords)
 * @param {string} text
 * @returns {string[]}
 */
export const tokenizeAndNormalize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

/**
 * Checks whether a token fuzzy-matches a target word given length-based thresholds.
 * - Length 1-3: exact match only (distance === 0)
 * - Length 4-6: max distance 1
 * - Length 7+: max distance 2
 * @param {string} token
 * @param {string} targetWord
 * @returns {{ matched: boolean, distance: number, ratio: number }}
 */
export const isFuzzyMatch = (token, targetWord) => {
  if (!token || !targetWord) return { matched: false, distance: 99, ratio: 0 };

  const tok = token.toLowerCase();
  const tgt = targetWord.toLowerCase();

  // Fast path: exact or substring match
  if (tgt === tok) return { matched: true, distance: 0, ratio: 1.0 };
  if (tgt.startsWith(tok) || tgt.includes(tok)) {
    return { matched: true, distance: 0, ratio: 0.9 };
  }

  // Length 1-2: exact match only
  // Length 3-6: max distance 1 (e.g. "ana" -> "anna", "fitnes" -> "fitness")
  // Length 7+: max distance 2 (e.g. "crosfit" -> "crossfit", "velachry" -> "velachery")
  const maxAllowedDist = tok.length <= 2 ? 0 : tok.length <= 6 ? 1 : 2;
  const dist = damerauLevenshteinDistance(tok, tgt);

  if (dist <= maxAllowedDist) {
    const maxLen = Math.max(tok.length, tgt.length);
    const ratio = Math.max(0, 1 - dist / maxLen);
    return { matched: true, distance: dist, ratio };
  }

  return { matched: false, distance: dist, ratio: 0 };
};

/**
 * Scores a document against query tokens with multi-field weighting:
 * - Partner ID: 12
 * - Name: 10
 * - Area: 8
 * - City: 7
 * - Workouts: 6
 * - Facilities / Amenities: 4
 * - Tags: 4
 * - Owner Name: 2
 * - Address: 2
 * @param {object} gym - Lean gym document
 * @param {string[]} queryTokens - Array of search tokens
 * @returns {number} - Total relevance score (0 if no meaningful match)
 */
export const scoreGymRelevance = (gym, queryTokens) => {
  if (!gym || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedTokensCount = 0;

  // Extract document fields into normalized arrays
  const partnerIdStr = (gym.partnerId || '').toLowerCase();
  const phoneStr = (gym.phone || '').toLowerCase().replace(/[^0-9]/g, '');
  const emailStr = (gym.email || '').toLowerCase();
  const nameWords = tokenizeAndNormalize(gym.name || '');
  const areaWords = tokenizeAndNormalize(gym.area || '');
  const cityWords = tokenizeAndNormalize(gym.city || '');
  const workoutWords = (gym.workouts || []).flatMap((w) => tokenizeAndNormalize(w));
  const facilityWords = (gym.facilities || []).flatMap((f) => tokenizeAndNormalize(f));
  const tagWords = (gym.tags || []).flatMap((t) => tokenizeAndNormalize(t));
  const ownerWords = tokenizeAndNormalize(gym.ownerName || '');
  const addressWords = tokenizeAndNormalize(gym.address || gym.fullAddress || '');

  for (const token of queryTokens) {
    let bestTokenScore = 0;

    // 1. Partner ID check (e.g. "GYM18")
    if (partnerIdStr && (partnerIdStr === token || partnerIdStr.includes(token))) {
      bestTokenScore = Math.max(bestTokenScore, 12);
    }

    // Phone / Email check
    const cleanDigitsToken = token.replace(/[^0-9]/g, '');
    if (phoneStr && cleanDigitsToken.length >= 4 && phoneStr.includes(cleanDigitsToken)) {
      bestTokenScore = Math.max(bestTokenScore, 10);
    }
    if (emailStr && emailStr.includes(token) && token.length >= 3) {
      bestTokenScore = Math.max(bestTokenScore, 10);
    }

    // 2. Name check (Weight: 10)
    for (const word of nameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 3. Area check (Weight: 8)
    for (const word of areaWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 4. City check (Weight: 7)
    for (const word of cityWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 7 * match.ratio);
      }
    }

    // 5. Workouts check (Weight: 6)
    for (const word of workoutWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    // 6. Facilities & Amenities check (Weight: 4)
    for (const word of facilityWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 4 * match.ratio);
      }
    }

    // 7. Tags check (Weight: 4)
    for (const word of tagWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 4 * match.ratio);
      }
    }

    // 8. Owner check (Weight: 2)
    for (const word of ownerWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 2 * match.ratio);
      }
    }

    // 9. Address check (Weight: 2)
    for (const word of addressWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 2 * match.ratio);
      }
    }

    if (bestTokenScore > 0) {
      matchedTokensCount++;
      totalScore += bestTokenScore;
    }
  }

  // If query contains multiple tokens, boost multi-match coverage
  if (queryTokens.length > 1) {
    const coverageRatio = matchedTokensCount / queryTokens.length;
    // Penalize if only a tiny fraction of query tokens matched
    if (coverageRatio < 0.5) {
      return 0;
    }
    totalScore *= (1 + coverageRatio);
  }

  return Math.round(totalScore * 10) / 10;
};

/**
 * Calculates a multi-field weighted fuzzy relevance score for a Promotional Banner.
 * Fields: Gym Name (10x), Title (10x), Subtitle (8x), Gym Area (8x), Slug (7x), Badge (6x), City (6x).
 * @param {object} banner - Banner document or plain object
 * @param {string[]} queryTokens - Array of search tokens
 * @returns {number} - Total relevance score (0 if no meaningful match)
 */
export const scoreBannerRelevance = (banner, queryTokens) => {
  if (!banner || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedTokensCount = 0;

  const gymNameWords = tokenizeAndNormalize(banner.gymName || banner.gymId?.name || '');
  const titleWords = tokenizeAndNormalize(banner.title || '');
  const subtitleWords = tokenizeAndNormalize(banner.subtitle || '');
  const gymAreaWords = tokenizeAndNormalize(banner.gymArea || banner.gymId?.area || '');
  const gymSlugWords = tokenizeAndNormalize(banner.gymSlug || banner.gymId?.slug || '');
  const badgeWords = tokenizeAndNormalize(banner.badgeText || '');
  const gymCityWords = tokenizeAndNormalize(banner.gymCity || banner.gymId?.city || '');

  for (const token of queryTokens) {
    let bestTokenScore = 0;

    // 1. Gym Name check (Weight: 10)
    for (const word of gymNameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 2. Title check (Weight: 10)
    for (const word of titleWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 3. Subtitle check (Weight: 8)
    for (const word of subtitleWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 4. Area check (Weight: 8)
    for (const word of gymAreaWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 5. Slug check (Weight: 7)
    for (const word of gymSlugWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 7 * match.ratio);
      }
    }

    // 6. Badge check (Weight: 6)
    for (const word of badgeWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    // 7. City check (Weight: 6)
    for (const word of gymCityWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    if (bestTokenScore > 0) {
      matchedTokensCount++;
      totalScore += bestTokenScore;
    }
  }

  // Multi-token coverage multiplier
  if (queryTokens.length > 1) {
    const coverageRatio = matchedTokensCount / queryTokens.length;
    if (coverageRatio < 0.5) {
      return 0;
    }
    totalScore *= (1 + coverageRatio);
  }

  return Math.round(totalScore * 10) / 10;
};

/**
 * Calculates a multi-field weighted fuzzy relevance score for a Booking.
 * Matches bookingId, customer name/email/phone/customerId, gym name/area/city/partnerId,
 * title, category, status, and trainer name.
 * @param {object} booking - Booking document or plain object
 * @param {string[]} queryTokens - Array of search tokens
 * @returns {number} - Total relevance score (0 if no meaningful match)
 */
export const scoreBookingRelevance = (booking, queryTokens) => {
  if (!booking || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedTokensCount = 0;

  const u = booking.userId || booking.user || {};
  const g = booking.gymId || booking.gym || {};
  const t = booking.trainerId || booking.trainer || {};

  const rawBookingId = String(booking.bookingId || '').toLowerCase();
  const cleanBookingId = rawBookingId.replace(/[^a-z0-9]/g, '');
  const bookingIdWords = Array.from(new Set([
    ...tokenizeAndNormalize(booking.bookingId || ''),
    rawBookingId,
    cleanBookingId,
  ])).filter(Boolean);

  const rawCustId = String(u.customerId || '').toLowerCase();
  const cleanCustId = rawCustId.replace(/[^a-z0-9]/g, '');
  const customerIdWords = Array.from(new Set([
    ...tokenizeAndNormalize(u.customerId || ''),
    rawCustId,
    cleanCustId,
  ])).filter(Boolean);

  const customerNameWords = tokenizeAndNormalize(u.fullName || u.name || '');
  const phoneWords = tokenizeAndNormalize(u.phone || '');
  const emailWords = tokenizeAndNormalize(u.email || '');
  const titleWords = tokenizeAndNormalize(booking.title || '');
  const gymNameWords = tokenizeAndNormalize(g.name || '');
  const gymPartnerIdWords = tokenizeAndNormalize(g.partnerId || '');
  const gymAreaWords = tokenizeAndNormalize(g.area || '');
  const gymCityWords = tokenizeAndNormalize(g.city || '');
  const trainerNameWords = tokenizeAndNormalize(t.fullName || t.name || '');
  const categoryWords = tokenizeAndNormalize(booking.category || '');
  const statusWords = tokenizeAndNormalize(booking.status || '');

  for (const token of queryTokens) {
    let bestTokenScore = 0;
    const cleanTok = String(token).toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Direct booking ID match (Weight: 14)
    if (cleanTok.length >= 3 && cleanBookingId && (cleanBookingId.includes(cleanTok) || cleanTok.includes(cleanBookingId))) {
      bestTokenScore = Math.max(bestTokenScore, 14);
    }
    for (const word of bookingIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 14 * match.ratio);
      }
    }

    // 2. Customer ID match (Weight: 12)
    if (cleanTok.length >= 3 && cleanCustId && (cleanCustId.includes(cleanTok) || cleanTok.includes(cleanCustId))) {
      bestTokenScore = Math.max(bestTokenScore, 12);
    }
    for (const word of customerIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 12 * match.ratio);
      }
    }

    // 3. Customer name match (Weight: 10)
    for (const word of customerNameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 4. Customer phone match (Weight: 10)
    for (const word of phoneWords) {
      if (token.length >= 3 && word.includes(token)) {
        bestTokenScore = Math.max(bestTokenScore, 10);
      }
    }

    // 5. Gym name match (Weight: 8)
    for (const word of gymNameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 6. Gym partner ID match (Weight: 8)
    for (const word of gymPartnerIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 7. Booking Title match (Weight: 8)
    for (const word of titleWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 8. Gym Area / Locality (Weight: 7)
    for (const word of gymAreaWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 7 * match.ratio);
      }
    }

    // 9. Customer email match (Weight: 6)
    for (const word of emailWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    // 10. Trainer Name match (Weight: 6)
    for (const word of trainerNameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    // 11. Category / Status / City (Weight: 5)
    for (const word of [...gymCityWords, ...categoryWords, ...statusWords]) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 5 * match.ratio);
      }
    }

    if (bestTokenScore > 0) {
      matchedTokensCount++;
      totalScore += bestTokenScore;
    }
  }

  // Multi-token coverage multiplier
  if (queryTokens.length > 1) {
    const coverageRatio = matchedTokensCount / queryTokens.length;
    if (coverageRatio < 0.5) {
      return 0;
    }
    totalScore *= (1 + coverageRatio);
  }

  return Math.round(totalScore * 10) / 10;
};

/**
 * Calculates a multi-field weighted fuzzy relevance score for a Unified Transaction.
 * Matches transactionId, referenceId, bookingId, membershipId, customer name/phone/email/customerId,
 * gym name/location/partnerId, title, paymentMode, status.
 * @param {object} tx - Transaction document or plain object
 * @param {string[]} queryTokens - Array of search tokens
 * @returns {number} - Total relevance score (0 if no meaningful match)
 */
export const scoreTransactionRelevance = (tx, queryTokens) => {
  if (!tx || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedTokensCount = 0;

  const rawTxn = String(tx.transactionId || tx.gatewayTxnId || '').toLowerCase();
  const cleanTxn = rawTxn.replace(/[^a-z0-9]/g, '');
  const txnIdWords = Array.from(new Set([
    ...tokenizeAndNormalize(tx.transactionId || tx.gatewayTxnId || ''),
    rawTxn,
    cleanTxn,
  ])).filter(Boolean);

  const rawRef = String(tx.referenceId || tx.bookingId || tx.membershipId || '').toLowerCase();
  const cleanRef = rawRef.replace(/[^a-z0-9]/g, '');
  const refIdWords = Array.from(new Set([
    ...tokenizeAndNormalize(tx.referenceId || tx.bookingId || tx.membershipId || ''),
    rawRef,
    cleanRef,
  ])).filter(Boolean);

  const rawCustId = String(tx.customerId || '').toLowerCase();
  const cleanCustId = rawCustId.replace(/[^a-z0-9]/g, '');
  const custIdWords = Array.from(new Set([
    ...tokenizeAndNormalize(tx.customerId || ''),
    rawCustId,
    cleanCustId,
  ])).filter(Boolean);

  const custNameWords = tokenizeAndNormalize(tx.customerName || '');
  const custPhoneWords = tokenizeAndNormalize(tx.customerPhone || '');
  const custEmailWords = tokenizeAndNormalize(tx.customerEmail || '');
  const gymNameWords = tokenizeAndNormalize(tx.gymName || '');
  const gymPartnerIdWords = tokenizeAndNormalize(tx.gymPartnerId || '');
  const gymLocationWords = tokenizeAndNormalize(tx.gymLocation || '');
  const titleWords = tokenizeAndNormalize(tx.title || '');
  const paymentModeWords = tokenizeAndNormalize(tx.paymentMode || '');
  const statusWords = tokenizeAndNormalize(tx.status || '');

  for (const token of queryTokens) {
    let bestTokenScore = 0;
    const cleanTok = String(token).toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Transaction ID match (Weight: 14)
    if (cleanTok.length >= 3 && cleanTxn && (cleanTxn.includes(cleanTok) || cleanTok.includes(cleanTxn))) {
      bestTokenScore = Math.max(bestTokenScore, 14);
    }
    for (const word of txnIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 14 * match.ratio);
      }
    }

    // 2. Reference / Booking ID match (Weight: 12)
    if (cleanTok.length >= 3 && cleanRef && (cleanRef.includes(cleanTok) || cleanTok.includes(cleanRef))) {
      bestTokenScore = Math.max(bestTokenScore, 12);
    }
    for (const word of refIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 12 * match.ratio);
      }
    }

    // 3. Customer name match (Weight: 10)
    for (const word of custNameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 4. Customer phone match (Weight: 10)
    for (const word of custPhoneWords) {
      if (token.length >= 3 && word.includes(token)) {
        bestTokenScore = Math.max(bestTokenScore, 10);
      }
    }

    // 5. Customer ID match (Weight: 10)
    for (const word of custIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 6. Gym Name match (Weight: 8)
    for (const word of gymNameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 7. Gym Partner ID match (Weight: 8)
    for (const word of gymPartnerIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 8. Title match (Weight: 7)
    for (const word of titleWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 7 * match.ratio);
      }
    }

    // 9. Gym Location / Locality (Weight: 7)
    for (const word of gymLocationWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 7 * match.ratio);
      }
    }

    // 10. Customer email match (Weight: 6)
    for (const word of custEmailWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    // 11. Payment Mode match (Weight: 6)
    for (const word of paymentModeWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 6 * match.ratio);
      }
    }

    // 12. Status match (Weight: 5)
    for (const word of statusWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 5 * match.ratio);
      }
    }

    if (bestTokenScore > 0) {
      matchedTokensCount++;
      totalScore += bestTokenScore;
    }
  }

  // Multi-token coverage multiplier
  if (queryTokens.length > 1) {
    const coverageRatio = matchedTokensCount / queryTokens.length;
    if (coverageRatio < 0.5) {
      return 0;
    }
    totalScore *= (1 + coverageRatio);
  }

  return Math.round(totalScore * 10) / 10;
};

/**
 * Calculates a multi-field weighted fuzzy relevance score for a Customer Report record.
 * Matches customerId, name, phone, email, status.
 * @param {object} record - Customer report object
 * @param {string[]} queryTokens - Array of search tokens
 * @returns {number} - Total relevance score (0 if no meaningful match)
 */
export const scoreReportCustomerRelevance = (record, queryTokens) => {
  if (!record || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedTokensCount = 0;

  const rawCustId = String(record.customerId || '').toLowerCase();
  const cleanCustId = rawCustId.replace(/[^a-z0-9]/g, '');
  const custIdWords = Array.from(new Set([
    ...tokenizeAndNormalize(record.customerId || ''),
    rawCustId,
    cleanCustId,
  ])).filter(Boolean);

  const nameWords = tokenizeAndNormalize(record.name || record.fullName || '');
  const phoneWords = tokenizeAndNormalize(record.phone || '');
  const emailWords = tokenizeAndNormalize(record.email || '');
  const statusWords = tokenizeAndNormalize(record.status || '');

  for (const token of queryTokens) {
    let bestTokenScore = 0;
    const cleanTok = String(token).toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Customer ID match (Weight: 14)
    if (cleanTok.length >= 3 && cleanCustId && (cleanCustId.includes(cleanTok) || cleanTok.includes(cleanCustId))) {
      bestTokenScore = Math.max(bestTokenScore, 14);
    }
    for (const word of custIdWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 14 * match.ratio);
      }
    }

    // 2. Customer Name match (Weight: 10)
    for (const word of nameWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 10 * match.ratio);
      }
    }

    // 3. Customer Phone match (Weight: 10)
    for (const word of phoneWords) {
      if (token.length >= 3 && word.includes(token)) {
        bestTokenScore = Math.max(bestTokenScore, 10);
      }
    }

    // 4. Customer Email match (Weight: 8)
    for (const word of emailWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 8 * match.ratio);
      }
    }

    // 5. Status match (Weight: 5)
    for (const word of statusWords) {
      const match = isFuzzyMatch(token, word);
      if (match.matched) {
        bestTokenScore = Math.max(bestTokenScore, 5 * match.ratio);
      }
    }

    if (bestTokenScore > 0) {
      matchedTokensCount++;
      totalScore += bestTokenScore;
    }
  }

  if (queryTokens.length > 1) {
    const coverageRatio = matchedTokensCount / queryTokens.length;
    if (coverageRatio < 0.5) return 0;
    totalScore *= (1 + coverageRatio);
  }

  return Math.round(totalScore * 10) / 10;
};

/**
 * Evaluates a user query and returns a "Did you mean" correction suggestion
 * if any token is a close misspelling of a canonical Chennai locality or fitness term.
 * @param {string} rawQuery
 * @returns {string|null} - Corrected string or null if no typo found
 */
export const getDidYouMeanSuggestion = (rawQuery) => {
  if (!rawQuery || typeof rawQuery !== 'string') return null;

  const tokens = tokenizeAndNormalize(rawQuery);
  if (tokens.length === 0) return null;

  let hasCorrection = false;
  const correctedTokens = [];

  for (const token of tokens) {
    if (token.length < 3) {
      correctedTokens.push(token);
      continue;
    }

    // Check if token already matches a canonical term exactly
    let exactFound = false;
    for (const term of DOMAIN_DICTIONARY) {
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

    // Search for closest dictionary term
    let bestCandidate = null;
    let minDistance = 99;

    for (const dictTerm of DOMAIN_DICTIONARY) {
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
    // Check if the joined tokens match a multi-word locality (e.g. "anna", "nagar" -> "Anna Nagar")
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
    // Return capitalized tokens
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
  scoreGymRelevance,
  scoreBannerRelevance,
  scoreBookingRelevance,
  scoreTransactionRelevance,
  scoreReportCustomerRelevance,
  getDidYouMeanSuggestion,
  CHENNAI_LOCALITIES_VOCAB,
  FITNESS_VOCAB,
};
