function normalizeTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function singularVariants(token: string): Set<string> {
  const variants = new Set([token]);
  if (token.endsWith('ies') && token.length > 4) {
    variants.add(`${token.slice(0, -3)}y`);
  }
  if (token.endsWith('es') && token.length > 3) {
    variants.add(token.slice(0, -2));
  }
  if (token.endsWith('s') && token.length > 3) {
    variants.add(token.slice(0, -1));
  }
  return variants;
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const before = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = before;
    }
  }
  return previous[b.length];
}

function tokenMatches(queryToken: string, candidateTokens: string[]): boolean {
  const queryVariants = singularVariants(queryToken);
  return candidateTokens.some((candidateToken) => {
    const candidateVariants = singularVariants(candidateToken);
    for (const queryVariant of queryVariants) {
      for (const candidateVariant of candidateVariants) {
        if (queryVariant === candidateVariant || candidateVariant.includes(queryVariant) || queryVariant.includes(candidateVariant)) {
          return true;
        }
        const maxLength = Math.max(queryVariant.length, candidateVariant.length);
        const allowedDistance = maxLength <= 5 ? 1 : 2;
        if (editDistance(queryVariant, candidateVariant) <= allowedDistance) {
          return true;
        }
      }
    }
    return false;
  });
}

export function fuzzyIncludes(query: string, values: Array<string | number | null | undefined>): boolean {
  const queryTokens = normalizeTokens(query);
  if (queryTokens.length === 0) {
    return true;
  }
  const candidateTokens = normalizeTokens(values.filter((value) => value !== null && value !== undefined).join(' '));
  if (candidateTokens.length === 0) {
    return false;
  }
  const candidateText = candidateTokens.join(' ');
  const queryText = queryTokens.join(' ');
  if (candidateText.includes(queryText)) {
    return true;
  }
  return queryTokens.every((queryToken) => tokenMatches(queryToken, candidateTokens));
}
