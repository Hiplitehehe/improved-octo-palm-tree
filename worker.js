
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 🔹 Serve Dashboard
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, { headers: { "Content-Type": "text/html" } });
    }

    // 🔹 Serve Login Page
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=user`,
        302
      );
    }

    // 🔹 Handle GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("GitHub OAuth failed", { status: 400 });

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const { access_token } = await tokenResponse.json();
      if (!access_token) return new Response("GitHub OAuth failed", { status: 400 });

      // Get user data
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "CloudflareWorker" },
      });

      const userData = await userResponse.json();
      if (!userData.login) return new Response("GitHub OAuth failed", { status: 400 });

      // Store user login in cookie
      const headers = new Headers();
      headers.append("Set-Cookie", `user=${userData.login}; Path=/; HttpOnly`);
      return new Response("Login successful! Redirecting...", {
        headers,
        status: 302,
      });
    }

    // 🔹 Fetch Notes
    if (url.pathname === "/notes") {
      return await fetchNotes(env);
    }

    // 🔹 Create New Note (Requires Login)
    if (url.pathname === "/make-note" && request.method === "POST") {
      return await createNote(request, env);
    }

    // 🔹 Approve a Note (Requires Admin)
    if (url.pathname.startsWith("/approve/") && request.method === "POST") {
      return await approveNote(url.pathname.split("/")[2], request, env);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// ✅ Fetch Notes from GitHub
async function fetchNotes(env) {
  const notesUrl = `https://api.github.com/repos/hiplitehehe/Notes/contents/j.json`;

  const response = await fetch(notesUrl, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "CloudflareWorker" },
  });

  if (!response.ok) {
    return new Response(`GitHub Error: ${response.statusText}`, { status: response.status });
  }

  const fileData = await response.json();
  const notes = JSON.parse(atob(fileData.content));
  return new Response(JSON.stringify(notes), { headers: { "Content-Type": "application/json" } });
}

// ✅ Create New Note (Requires Login)
async function createNote(request, env) {
  const user = getUserFromCookie(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { title, content } = await request.json();
  if (!title || !content) return new Response("Missing fields", { status: 400 });

  const notesUrl = `https://api.github.com/repos/hiplitehehe/Notes/contents/j.json`;
  const fetchNotes = await fetch(notesUrl, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "CloudflareWorker" },
  });

  let notes = [], sha = "";
  if (fetchNotes.ok) {
    const fileData = await fetchNotes.json();
    notes = JSON.parse(atob(fileData.content));
    sha = fileData.sha;
  }

  notes.push({ id: Date.now(), title, content, approved: false, author: user });

  const updateResponse = await fetch(notesUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Added note: ${title}`,
      content: btoa(JSON.stringify(notes, null, 2)),
      sha: sha,
    }),
  });

  if (!updateResponse.ok) return new Response("Failed to add note", { status: 500 });
  return new Response("Note submitted!", { status: 200 });
}

// ✅ Approve a Note (Only for Admin)
async function approveNote(noteId, request, env) {
  const user = getUserFromCookie(request);
  if (!user || user !== "adminUser") return new Response("Forbidden", { status: 403 });

  const notesUrl = `https://api.github.com/repos/hiplitehehe/Notes/contents/j.json`;

  const fetchNotes = await fetch(notesUrl, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "CloudflareWorker" },
  });

  if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

  const fileData = await fetchNotes.json();
  let notes = JSON.parse(atob(fileData.content));
  let sha = fileData.sha;

  let note = notes.find(n => n.id == noteId);
  if (note) note.approved = true;

  const updateResponse = await fetch(notesUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Approved note: ${note.title}`,
      content: btoa(JSON.stringify(notes, null, 2)),
      sha: sha,
    }),
  });

  if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });
  return new Response("Note approved!", { status: 200 });
}

// ✅ Get User from Cookie
function getUserFromCookie(request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/user=([^;]+)/);
  return match ? match[1] : null;
}
