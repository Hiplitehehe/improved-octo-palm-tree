
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🟢 Serve HTML Pages
    if (url.pathname === "/") return serveHtml("dashboard.html", env);
    if (url.pathname === "/admin") return serveHtml("admin.html", env);
    if (url.pathname === "/login") return serveHtml("login.html", env);
    if (url.pathname === "/callback") return serveHtml("callback.html", env);

    // 🔵 Handle API Routes
    if (url.pathname === "/make-note" && request.method === "POST") return handleMakeNote(request, env);
    if (url.pathname === "/approve" && request.method === "POST") return handleApprove(request, env);
    if (url.pathname === "/notes") return handleFetchNotes(request, env);

    return new Response("Not Found", { status: 404 });
  },
};

// 📄 Serve HTML Pages
async function serveHtml(fileName, env) {
  const html = await env.HTML_FILES.get(fileName);
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

// ✏️ Make a New Note
async function handleMakeNote(request, env) {
  try {
    const { title, content, token } = await request.json();
    if (!title || !content || !token) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

    // ✅ Validate User Token
    const user = await validateUser(token, env);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    // 📜 Fetch Current Notes
    const { notes, sha } = await fetchNotesFromGitHub(env);
    notes.push({ title, content, approved: false });

    // 🔄 Update GitHub Notes
    await updateGitHubNotes(notes, sha, env);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// ✅ Approve a Note (Admin Only)
async function handleApprove(request, env) {
  try {
    const { index, token } = await request.json();
    if (typeof index !== "number" || !token) return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400 });

    // 🔒 Check Admin Access
    if (token !== env.ADMIN_TOKEN) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    // 📜 Fetch Notes & Approve One
    const { notes, sha } = await fetchNotesFromGitHub(env);
    if (!notes[index]) return new Response(JSON.stringify({ error: "Note not found" }), { status: 404 });
    notes[index].approved = true;

    // 🔄 Save Approved Note
    await updateGitHubNotes(notes, sha, env);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// 📄 Fetch Notes (Users See Approved Only, Admin Sees All)
async function handleFetchNotes(request, env) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // 🛡️ If Admin, Show Everything
    const isAdmin = token === env.ADMIN_TOKEN;
    const { notes } = await fetchNotesFromGitHub(env);

    return new Response(JSON.stringify({ notes: isAdmin ? notes : notes.filter(n => n.approved) }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// 🔄 Fetch Notes from GitHub
async function fetchNotesFromGitHub(env) {
  const repo = "hiplitehehe/notes";
  const filePath = "j.json";
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const headers = {
    "Authorization": `token ${env.GITHUB_TOKEN}`,
    "User-Agent": "Cloudflare-Worker",
  };

  const response = await fetch(apiUrl, { headers });
  if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

  const fileData = await response.json();
  return { notes: JSON.parse(atob(fileData.content)), sha: fileData.sha };
}

// 🔄 Update Notes on GitHub
async function updateGitHubNotes(notes, sha, env) {
  const repo = "hiplitehehe/notes";
  const filePath = "j.json";
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const headers = {
    "Authorization": `token ${env.GITHUB_TOKEN}`,
    "User-Agent": "Cloudflare-Worker",
  };

  const body = JSON.stringify({
    message: "Update notes",
    content: btoa(JSON.stringify(notes, null, 2)),
    sha,
  });

  const response = await fetch(apiUrl, { method: "PUT", headers, body });
  if (!response.ok) throw new Error(`GitHub Update Failed: ${response.statusText}`);
}

// 🛡️ Validate User Token
async function validateUser(token, env) {
  const response = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `token ${token}`, "User-Agent": "Cloudflare-Worker" },
  });

  if (!response.ok) return null;
  return await response.json();
}
