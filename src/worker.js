export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback for client-side routes.
    if (!url.pathname.includes(".")) {
      const spaRequest = new Request(new URL("/index.html", url), request);
      return env.ASSETS.fetch(spaRequest);
    }

    return assetResponse;
  },
};
