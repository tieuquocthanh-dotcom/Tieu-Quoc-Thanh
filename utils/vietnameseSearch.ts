export const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

export const normalizeVietnamese = (str: string): string => {
  if (!str) return '';
  return str.normalize('NFC').toLowerCase().trim();
};

/**
 * Calculates a search relevance score for a target string against a query.
 * Higher score = more relevant match. 0 = no match.
 */
export const getVietnameseSearchScore = (
  target: string | undefined | null,
  query: string | undefined | null
): number => {
  if (!target || !query) return 0;
  const tNorm = normalizeVietnamese(target);
  const qNorm = normalizeVietnamese(query);
  if (!tNorm || !qNorm) return 0;

  const tClean = removeVietnameseTones(tNorm);
  const qClean = removeVietnameseTones(qNorm);

  const qHasAccents = qNorm !== qClean;

  // Exact matches
  if (tNorm === qNorm) return 1000;
  if (!qHasAccents && tClean === qClean) return 950;

  // Clean words of boundary punctuation (e.g. "Hùng,", "Hùng.", "(Hùng)")
  const cleanWord = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const tWordsNorm = tNorm.split(/\s+/).map(cleanWord).filter(Boolean);
  const tWordsClean = tClean.split(/\s+/).map(cleanWord).filter(Boolean);
  const qWordsNorm = qNorm.split(/\s+/).map(cleanWord).filter(Boolean);
  const qWordsClean = qClean.split(/\s+/).map(cleanWord).filter(Boolean);

  // Single word query matching exact word in target
  // e.g. target: "Nguyễn Văn Hùng", query: "hùng" -> word matches "hùng"!
  if (qWordsNorm.length === 1) {
    const qwNorm = qWordsNorm[0];
    const qwClean = qWordsClean[0];
    const lastWordNorm = tWordsNorm[tWordsNorm.length - 1];
    const lastWordClean = tWordsClean[tWordsClean.length - 1];

    // Priority 1: When query has accents, match exact accented words
    if (lastWordNorm === qwNorm) return 960; // Exact last name match (e.g. "Nguyễn Văn Hùng" -> "hùng")
    if (tWordsNorm.some(w => w === qwNorm)) return 920; // Any exact accented word match
    if (tNorm.startsWith(qNorm)) return 900; // Target starts with query (with accents)
    if (tWordsNorm.some(w => w.startsWith(qwNorm))) return 850; // Word starts with query

    // Priority 2: When query does NOT have accents (e.g. "hung")
    if (!qHasAccents) {
      if (lastWordClean === qwClean) return 820;
      if (tWordsClean.some(w => w === qwClean)) return 800;
      if (tClean.startsWith(qClean)) return 750;
      if (tWordsClean.some(w => w.startsWith(qwClean))) return 700;
    } else {
      // Query HAS accents, but target only matches without accents
      // If target itself in DB has no accents (e.g. "Nguyen Van Hung" in db), match clean:
      const targetHasNoAccents = tNorm === tClean;
      if (targetHasNoAccents) {
        if (lastWordClean === qwClean) return 810;
        if (tWordsClean.some(w => w === qwClean)) return 790;
        if (tClean.startsWith(qClean)) return 740;
      } else {
        // Target in DB has DIFFERENT accents (e.g. target is "Hưng" and query is "hùng"): very low score
        if (tClean.startsWith(qClean)) return 150;
        if (tWordsClean.some(w => w === qwClean)) return 140;
        if (tWordsClean.some(w => w.startsWith(qwClean))) return 120;
      }
    }
  }

  // Multi word query
  if (qWordsNorm.length > 1) {
    // Exact match of phrase with accents
    if (tNorm.includes(qNorm)) return 940;
    if (tClean.includes(qClean)) return !qHasAccents ? 800 : 300;

    const allWordsMatchNorm = qWordsNorm.every(qw => tWordsNorm.some(tw => tw.startsWith(qw)));
    if (allWordsMatchNorm) return 880;

    const allWordsMatchClean = qWordsClean.every(qw => tWordsClean.some(tw => tw.startsWith(qw)));
    if (allWordsMatchClean) return !qHasAccents ? 720 : 250;
  }

  // Substring inside words (e.g. "hùng" inside "phùng" or "thùng")
  // Keep score low so that true word matches always appear first!
  if (tNorm.includes(qNorm)) return 400;
  if (tClean.includes(qClean)) return !qHasAccents ? 200 : 50;

  return 0;
};

/**
 * Checks if target matches query using Vietnamese-aware matching (handles NFC, NFD, accents, and unaccented search).
 */
export const searchVietnameseMatch = (
  target: string | undefined | null,
  query: string | undefined | null
): boolean => {
  if (!query || !query.trim()) return true;
  if (!target) return false;
  return getVietnameseSearchScore(target, query) > 0;
};

export interface CustomerSearchable {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
}

/**
 * Calculates total match score for a customer against a query (checks name, phone, address).
 */
export const getCustomerMatchScore = (customer: CustomerSearchable, query: string): number => {
  if (!query || !query.trim()) return 0;
  const q = query.trim();
  const qDigits = q.replace(/\D/g, '');

  let phoneScore = 0;
  if (customer.phone) {
    const pDigits = customer.phone.replace(/\D/g, '');
    if (pDigits === qDigits && qDigits.length > 0) {
      phoneScore = 1000;
    } else if (pDigits.startsWith(qDigits) && qDigits.length > 0) {
      phoneScore = 850;
    } else if (pDigits.includes(qDigits) && qDigits.length > 0) {
      phoneScore = 750;
    } else if (customer.phone.includes(q)) {
      phoneScore = 750;
    }
  }

  const nameScore = getVietnameseSearchScore(customer.name, q);
  const addressScore = customer.address ? Math.floor(getVietnameseSearchScore(customer.address, q) * 0.5) : 0;

  return Math.max(nameScore, phoneScore, addressScore);
};

/**
 * Filters and sorts customer list based on Vietnamese search query.
 * Puts exact/prefix/word matches at the top and slices up to `limit` items (default: 40).
 */
export const filterAndSortCustomers = <T extends CustomerSearchable>(
  customers: T[],
  query: string,
  limit: number = 60
): T[] => {
  if (!query || !query.trim()) {
    return customers.slice(0, limit);
  }

  const q = query.trim();
  const scored: { item: T; score: number }[] = [];

  for (const item of customers) {
    const score = getCustomerMatchScore(item, q);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.item);
};
