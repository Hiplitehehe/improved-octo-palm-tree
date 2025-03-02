
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔹 Serve the Dashboard
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, { headers: { "Content-Type": "text/html" } });
    }

    // 🔹 GitHub OAuth Login
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

    // 🔹 GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URI
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });

      return Response.redirect(`/dashboard?token=${tokenData.access_token}`, 302);
    }

    // 🔹 Make a Note
    if (url.pathname === "/make-note" && request.method === "POST") {
      return await makeNote(request, env);
    }

    // 🔹 Approve a Note (Only Admins)
    if (url.pathname === "/approve" && request.method === "POST") {
      return await approveNote(request, env);
    }

    // 🔹 Get Approved Notes
    if (url.pathname === "/notes") {
      return await getNotes(env);
    }

    return new Response("Not Found", { status: 404 });
  }
};

// 🔹 Allowed Admins
const ADMIN_USERS = ["your-github-username"]; // Replace with actual admin usernames

// 🔹 Function to Make a Note
async function makeNote(request, env) {
  try {
    const { title, content } = await request.json();
    if (!title || !content) return new Response("Missing title or content", { status: 400 });

    const repo = "hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const fetchNotes = await fetch(notesUrl, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
    });

    let notes = [];
    let sha = null;
    if (fetchNotes.ok) {
      const fileData = await fetchNotes.json();
      notes = JSON.parse(atob(fileData.content));
      sha = fileData.sha;
    }

    notes.push({ title, content, approved: false });

    const updateResponse = await fetch(notesUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Added note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: sha,
      }),
    });

    if (!updateResponse.ok) return new Response("Failed to add note", { status: 500 });

    return new Response(JSON.stringify({ message: `Note "${title}" added!` }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { status: 500 });
  }
}

// 🔹 Function to Approve a Note (Admins Only)
async function approveNote(request, env) {
  try {
    const { title, user } = await request.json();
    if (!title) return new Response("Missing note title", { status: 400 });

    if (!ADMIN_USERS.includes(user)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const repo = "hiplitehehe/Notes";
    const notesFile = "j.json";
    const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

    const fetchNotes = await fetch(notesUrl, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
    });

    if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

    const fileData = await fetchNotes.json();
    let notes = JSON.parse(atob(fileData.content));
    const sha = fileData.sha;

    const note = notes.find(n => n.title === title);
    if (!note) return new Response("Note not found", { status: 404 });

    note.approved = true;

    const updateResponse = await fetch(notesUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Approved note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: sha,
      }),
    });

    if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });

    return new Response(JSON.stringify({ message: `Note "${title}" approved!` }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { status: 500 });
  }
}

// 🔹 Function to Get Approved Notes
async function getNotes(env) {
  const repo = "Hiplitehehe/Notes";
  const notesFile = "j.json";
  const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

  const fetchNotes = await fetch(notesUrl, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
  });

  if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

  const fileData = await fetchNotes.json();
  const notes = JSON.parse(atob(fileData.content));
  const approvedNotes = notes.filter(note => note.approved);

  return new Response(JSON.stringify(approvedNotes), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    status: 200,
  });
}
