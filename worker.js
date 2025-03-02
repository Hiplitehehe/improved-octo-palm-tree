
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the dashboard
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Verify token route
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

    // Approve note route
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
