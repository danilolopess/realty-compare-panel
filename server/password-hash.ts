export function decodePasswordHash(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (trimmed.startsWith('$2')) return trimmed
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8')
    if (decoded.startsWith('$2')) return decoded
  } catch {
    // não é base64
  }
  let hashValue = trimmed
  while (hashValue.includes('$$')) {
    hashValue = hashValue.replaceAll('$$', '$')
  }
  return hashValue.startsWith('$2') ? hashValue : undefined
}

export function resolvePasswordHash(
  dbHash: string | undefined,
  envRaw: string | undefined,
): string | undefined {
  const fromDb = dbHash?.trim()
  if (fromDb?.startsWith('$2')) return fromDb
  return decodePasswordHash(envRaw)
}
