document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");
  const button = document.getElementById("loginButton");
  const message = document.getElementById("loginMessage");

  const setMessage = (text, type = "info") => {
    message.textContent = text;
    message.dataset.type = type;
  };

  button?.addEventListener("click", () => {
    if (passwordInput.value.trim()) return;
    setMessage("请输入管理员密码。", "error");
    passwordInput.focus();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) {
      setMessage("请输入管理员密码。", "error");
      passwordInput.focus();
      return;
    }

    button.disabled = true;
    setMessage("正在登录...");

    try {
      await Auth.login(password);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/";
      window.location.href = next.startsWith("/") ? next : "/";
    } catch (error) {
      setMessage(error.message || "登录失败，请检查密码。", "error");
      passwordInput.select();
    } finally {
      button.disabled = false;
    }
  });
});
