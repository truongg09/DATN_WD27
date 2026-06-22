export const unwrapList = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === 'object' && 'data' in response) {
    return unwrapList<T>((response as { data: unknown }).data);
  }

  return [];
};
