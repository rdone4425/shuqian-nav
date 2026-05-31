const DELETE_CANDIDATE_STATUSES = new Set([404, 410]);
const ACCESSIBLE_STATUSES = new Set([401]);
const REVIEW_STATUSES = new Set([403, 429, 500, 502, 503, 504]);

export function classifyHttpResponse(response) {
  const status = response.status;

  if ((status >= 200 && status < 400) || ACCESSIBLE_STATUSES.has(status)) {
    return {
      accessible: true,
      deleteCandidate: false,
      reviewRequired: false,
      resultType: "accessible",
    };
  }

  if (DELETE_CANDIDATE_STATUSES.has(status)) {
    return {
      accessible: false,
      deleteCandidate: true,
      reviewRequired: false,
      resultType: "broken",
    };
  }

  return {
    accessible: false,
    deleteCandidate: false,
    reviewRequired: true,
    resultType: REVIEW_STATUSES.has(status) ? "review" : "unknown",
  };
}

export function classifyNetworkError(errorMessage = "") {
  const message = errorMessage.toLowerCase();
  const isMissingDomain =
    message.includes("enotfound") ||
    message.includes("name not resolved") ||
    message.includes("dns");

  return {
    accessible: false,
    deleteCandidate: isMissingDomain,
    reviewRequired: !isMissingDomain,
    resultType: isMissingDomain ? "broken" : "review",
  };
}
