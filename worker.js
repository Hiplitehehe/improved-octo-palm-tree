
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the login page
    if (url.pathname === "/login") {
      const loginHtml = await env.HTML_FILES.get("login.html");
      return new Response(loginHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // OAuth Callback - GitHub redirects here with `code`
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing authorization code", { status: 400 });
      }

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response("Failed to get access token", { status: 400 });
      }

      return new Response(`<script>window.location.href="/dashboard?token=${tokenData.access_token}"</script>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve the dashboard
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Verify token
    if (url.pathname === "/verify-token") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ valid: false }), { 
          headers: { "Content-Type": "application/json" },
          status: 401
        });
      }

      const token = authHeader.split(" ")[1];
      return new Response(JSON.stringify({ valid: token === env.ALLOWED_TOKEN }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    }

    // Approve note
    if (url.pathname === "/approve") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.split(" ")[1];
      if (token !== env.ALLOWED_TOKEN) {
        return new Response("Permission denied: Invalid token", { status: 403 });
      }

      return new Response("Note approved!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
