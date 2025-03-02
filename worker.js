

const ALLOWED_USERS = ["Hiplitehehe"]; // Replace with your GitHub username

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve Dashboard page
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Login route: redirect to GitHub for OAuth
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=user`,
        302
      );
    }

    // OAuth Callback: exchange code for token, then fetch user data and set cookie
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

      // Fetch user data from GitHub
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "CloudflareWorker" },
      });
      const userData = await userResponse.json();
      if (!userData.login) return new Response("GitHub OAuth failed", { status: 400 });

      // Set the "user" cookie with the GitHub login
      const headers = new Headers();
      headers.append("Set-Cookie", `user=${userData.login}; Path=/; HttpOnly`);
      // Redirect to the dashboard after login
      headers.append("Location", "/dashboard");
      return new Response("Login successful! Redirecting...", {
        headers,
        status: 302,
      });
    }

    // Return current user from cookie (for client-side use)
    if (url.pathname === "/user") {
      const user = getUserFromCookie(request);
      return new Response(user || "Guest", { status: 200 });
    }

    // Fetch all notes (both approved and pending)
    if (url.pathname === "/notes") {
      return await fetchNotes(env);
    }

    // Create a new note (requires a logged-in user)
    if (url.pathname === "/make-note" && request.method === "POST") {
      return await createNote(request, env);
    }

    // Approve a note (only allowed for admin users)
    if (url.pathname.startsWith("/approve/") && request.method === "POST") {
      const noteId = url.pathname.split("/")[2];
      return await approveNote(noteId, request, env);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// Helper: Get username from cookie
function getUserFromCookie(request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/user=([^;]+)/);
  return match ? match[1] : null;
}

// Fetch notes from GitHub (reads j.json)
async function fetchNotes(env) {
  const notesUrl = `https://api.github.com/repos/Hiplitehehe/Notes/contents/j.json`;

  const response = await fetch(notesUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Accept": "application/vnd.github.v3+json",
    },
  });
  if (!response.ok) {
    return new Response(`GitHub Error: ${response.statusText}`, { status: response.status });
  }
  const fileData = await response.json();
  const notes = JSON.parse(atob(fileData.content));
  return new Response(JSON.stringify(notes), {
    headers: { "Content-Type": "application/json" },
  });
}

// Create a new note and update GitHub (j.json)
async function createNote(request, env) {
  const user = getUserFromCookie(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { title, content } = await request.json();
  if (!title || !content) return new Response("Missing fields", { status: 400 });

  const notesUrl = `https://api.github.com/repos/Hiplitehehe/Notes/contents/j.json`;
  const fetchNotes = await fetch(notesUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Accept": "application/vnd.github.v3+json",
    },
  });
  let notes = [], sha = "";
  if (fetchNotes.ok) {
    const fileData = await fetchNotes.json();
    notes = JSON.parse(atob(fileData.content));
    sha = fileData.sha;
  }
  // Add the new note with an id and author from the cookie
  notes.push({ id: Date.now(), title, content, approved: false, author: user });

  const updateResponse = await fetch(notesUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json",
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

// Approve a note (only allowed if the logged-in user is in ALLOWED_USERS)
async function approveNote(noteId, request, env) {
  const user = getUserFromCookie(request);
  if (!user || !ALLOWED_USERS.includes(user)) return new Response("Forbidden", { status: 403 });

  const notesUrl = `https://api.github.com/repos/Hiplitehehe/Notes/contents/j.json`;
  const fetchNotes = await fetch(notesUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Accept": "application/vnd.github.v3+json",
    },
  });
  if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

  const fileData = await fetchNotes.json();
  let notes = JSON.parse(atob(fileData.content));
  const sha = fileData.sha;

  let note = notes.find(n => n.id == noteId);
  if (!note) return new Response("Note not found", { status: 404 });

  note.approved = true;

  const updateResponse = await fetch(notesUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "CloudflareWorker",
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json",
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
