export function isTransportUnavailableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return /failed to fetch|load failed|networkerror/i.test(error.message);
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const values = ['message', 'details']
    .filter((key) => key in error)
    .map((key) => String(Reflect.get(error, key)));

  return values.some((value) =>
    /failed to fetch|load failed|networkerror|network request failed/i.test(
      value,
    ),
  );
}
