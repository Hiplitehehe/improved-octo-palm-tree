
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔹 Serve the Dashboard
    if (url.pathname === "/dashboard") {
      return new Response(await env.HTML_FILES.get("dashboard.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // 🔹 GitHub Login Redirect
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
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URI
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });
      }

      return Response.redirect(
        `https://my-worker.hiplitehehe.workers.dev/dashboard?token=${tokenData.access_token}`,
        302
      );
    }

    // 🔹 Get Notes (Admins See All, Others See Approved)
    if (url.pathname === "/notes") {
      const authHeader = request.headers.get("Authorization");
      const token = authHeader ? authHeader.split(" ")[1] : null;
      const isAdmin = token === env.ADMIN_TOKEN;

      return await fetchNotes(env, isAdmin);
    }

    // 🔹 Make a Note (Anyone Can)
    if (url.pathname === "/make-note") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing title/content", { status: 400 });

      return await addNote(env, body);
    }

    // 🔹 Approve Note (Admins Only)
    if (url.pathname === "/approve") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

      const token = authHeader.split(" ")[1];
      if (token !== env.ADMIN_TOKEN) return new Response("Permission denied", { status: 403 });

      const body = await request.json();
      if (!body.title) return new Response("Missing note title", { status: 400 });

      return await approveNote(env, body.title);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// 🔹 Fetch Notes (Admin Sees All, Others See Approved Only)
async function fetchNotes(env, isAdmin) {
  try {
    const response = await fetch(`https://api.github.com/repos/hiplitehehe/notes/contents/j.json`, {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    const filteredNotes = isAdmin ? notes : notes.filter(note => note.approved);

    return new Response(JSON.stringify(filteredNotes), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}

// 🔹 Add a New Note (Unapproved by Default)
async function addNote(env, newNote) {
  try {
    const response = await fetch(`https://api.github.com/repos/hiplitehehe/notes/contents/j.json`, {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    notes.push({ title: newNote.title, content: newNote.content, approved: false });

    await updateNotes(env, notes, `Added note: ${newNote.title}`);
    return new Response(JSON.stringify({ message: `Note "${newNote.title}" created!` }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}

// 🔹 Approve a Note (Admins Only)
async function approveNote(env, noteTitle) {
  try {
    const response = await fetch(`https://api.github.com/repos/hiplitehehe/notes/contents/j.json`, {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    const note = notes.find(n => n.title === noteTitle);
    if (!note) return new Response("Note not found", { status: 404 });

    note.approved = true;
    await updateNotes(env, notes, `Approved note: ${noteTitle}`);

    return new Response(JSON.stringify({ message: `Note "${noteTitle}" approved!` }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}

// 🔹 Update Notes in GitHub
async function updateNotes(env, notes, commitMessage) {
  const notesUrl = `https://api.github.com/repos/hiplitehehe/notes/contents/j.json`;

  const fileResponse = await fetch(notesUrl, {
    headers: { "User-Agent": "Cloudflare-Worker" }
  });

  if (!fileResponse.ok) throw new Error(`GitHub API error: ${fileResponse.statusText}`);

  const fileData = await fileResponse.json();
  const updatedContent = btoa(JSON.stringify(notes, null, 2));

  const updateResponse = await fetch(notesUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: updatedContent,
      sha: fileData.sha,
    }),
  });

  if (!updateResponse.ok) throw new Error("Failed to update notes");
}
