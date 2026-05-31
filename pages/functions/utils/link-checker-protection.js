const PROTECTED_SITE_HOSTS = new Set(["linux.do"]);

function normalizeHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isKnownProtectedSite(url) {
  const hostname = normalizeHostname(url);
  return PROTECTED_SITE_HOSTS.has(hostname);
}

export function getKnownProtectedSiteResult(url, method = "PROTECTED_SITE") {
  if (!isKnownProtectedSite(url)) {
    return null;
  }

  return {
    url,
    accessible: true,
    status: 200,
    statusText: "Protected site",
    error: null,
    method,
    checkedAt: new Date().toISOString(),
    note: "Skipped active probing because this site blocks automated link checks.",
  };
}
