export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  if (import.meta.env.DEV) {
    try {
      const proxyUrl = `/api-proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, init);
      if (res.status === 502 || res.status === 500) {
        return await fetch(url, init);
      }
      return res;
    } catch {
      return await fetch(url, init);
    }
  }
  return await fetch(url, init);
}
