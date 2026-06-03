const tokenState = {
  tokens: [],
  busy: false,
};

function setTokenStatus(message) {
  document.getElementById("tokenGuardStatus").textContent = message;
}

function tokenHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...window.Auth.getAuthHeaders(),
  };
}

function showTokenForm(visible) {
  document.getElementById("tokenForm").classList.toggle("hidden", !visible);
}

function renderTokenList() {
  const listEl = document.getElementById("tokenList");
  if (!tokenState.tokens.length) {
    listEl.innerHTML =
      '<article class="token-mini-card"><strong>暂无令牌</strong><span>点击“生成令牌”创建第一个同步令牌。</span></article>';
    return;
  }

  listEl.innerHTML = tokenState.tokens
    .map(
      (token) => `
        <article class="token-mini-card">
          <strong>${AdminUI.escapeHtml(token.name || "未命名令牌")}</strong>
          <span>${AdminUI.escapeHtml(token.description || "无说明")}</span>
          <span>创建：${AdminUI.formatDate(token.created || token.createdAt)}</span>
          <span>过期：${AdminUI.formatDate(token.expires)}</span>
          <button class="btn btn-soft delete-token-btn" type="button" data-token-id="${AdminUI.escapeHtml(token.id)}" data-token-name="${AdminUI.escapeHtml(token.name || "未命名令牌")}">
            删除
          </button>
        </article>
      `,
    )
    .join("");

  listEl.querySelectorAll(".delete-token-btn").forEach((button) => {
    button.addEventListener("click", () =>
      requestDeleteToken(button.dataset.tokenId, button.dataset.tokenName),
    );
  });
}

async function refreshTokenGuardStatus() {
  setTokenStatus("正在检查当前配置...");

  try {
    const response = await fetch("/api/auth/token", {
      method: "GET",
      headers: tokenHeaders(),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 403) {
      showTokenForm(false);
      setTokenStatus(
        "令牌管理被配置关闭。请移除 PUBLIC_API_TOKEN_MANAGEMENT=disabled 后再生成令牌。",
      );
      return;
    }

    if (response.ok) {
      tokenState.tokens = data.data || [];
      showTokenForm(true);
      renderTokenList();
      setTokenStatus("已登录管理员，可以生成和管理同步令牌。");
      return;
    }

    setTokenStatus(
      data.error || "令牌状态检查失败，HTTP 状态码：" + response.status,
    );
  } catch (error) {
    setTokenStatus("令牌状态检查失败：" + error.message);
  }
}

async function createToken(event) {
  event.preventDefault();
  if (tokenState.busy) return;

  tokenState.busy = true;
  const button = document.getElementById("createTokenBtn");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "生成中...";

  try {
    const response = await fetch("/api/auth/token", {
      method: "POST",
      headers: tokenHeaders(),
      body: JSON.stringify({
        name: document.getElementById("tokenName").value.trim(),
        description: document.getElementById("tokenDescription").value.trim(),
        expiresIn:
          parseInt(document.getElementById("tokenExpiresIn").value, 10) || 365,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "生成令牌失败");
    }

    document.getElementById("createdTokenValue").textContent = data.data.token;
    document.getElementById("tokenResult").classList.remove("hidden");
    setTokenStatus("令牌已生成，请立即复制保存。");
    await refreshTokenGuardStatus();
  } catch (error) {
    setTokenStatus("生成令牌失败：" + error.message);
  } finally {
    tokenState.busy = false;
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function copyCreatedToken() {
  const token = document.getElementById("createdTokenValue").textContent;
  if (!token) return;
  await navigator.clipboard.writeText(token);
  setTokenStatus("令牌已复制。");
}

async function requestDeleteToken(tokenId, tokenName) {
  if (!tokenId) return;

  const confirmed = await AdminUI.confirm({
    title: "删除同步令牌",
    message: `确定删除同步令牌“${tokenName || "未命名令牌"}”吗？`,
    hint: "删除后，正在使用这个令牌的浏览器扩展或自动化同步会立刻失效。",
    confirmText: "删除令牌",
    variant: "danger",
  });

  if (confirmed) {
    await deleteToken(tokenId);
  }
}

async function deleteToken(tokenId) {
  if (!tokenId) return;

  try {
    const response = await fetch("/api/auth/token", {
      method: "POST",
      headers: tokenHeaders(),
      body: JSON.stringify({ action: "delete", tokenId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "删除令牌失败");
    }
    setTokenStatus("令牌已删除。");
    await refreshTokenGuardStatus();
  } catch (error) {
    setTokenStatus("删除令牌失败：" + error.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const authenticated = await AdminUI.requireAuth();
  if (!authenticated) return;

  document.getElementById("syncEndpoint").textContent =
    window.location.origin + "/api/bookmarks/sync";
  document
    .getElementById("checkTokenGuardBtn")
    .addEventListener("click", refreshTokenGuardStatus);
  document
    .getElementById("refreshTokensBtn")
    .addEventListener("click", refreshTokenGuardStatus);
  document.getElementById("tokenForm").addEventListener("submit", createToken);
  document
    .getElementById("copyTokenBtn")
    .addEventListener("click", copyCreatedToken);
  refreshTokenGuardStatus();
});
