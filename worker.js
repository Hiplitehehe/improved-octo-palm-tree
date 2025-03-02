
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/make-note" && request.method === "POST") {
      return handleMakeNote(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleMakeNote(request, env) {
  try {
    const { title, content, token } = await request.json();

    if (!title || !content || !token) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // Validate user token
    const user = await validateUser(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Fetch current notes from GitHub
    const repo = "hiplitehehe/notes";
    const filePath = "j.json";
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    const headers = {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "Cloudflare-Worker",
    };

    const fileResponse = await fetch(apiUrl, { headers });
    if (!fileResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch notes" }), { status: 500 });
    }

    const fileData = await fileResponse.json();
    const notes = JSON.parse(atob(fileData.content));

    // Add new note
    const newNote = { title, content, approved: false };
    notes.push(newNote);

    // Update file on GitHub
    const updatedContent = btoa(JSON.stringify(notes, null, 2));
    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "Add new note",
        content: updatedContent,
        sha: fileData.sha,
      }),
    });

    if (!updateResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to save note" }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Validate token and get user info
async function validateUser(token, env) {
  const userResponse = await fetch(`https://api.github.com/user`, {
    headers: {
      "Authorization": `token ${token}`,
      "User-Agent": "Cloudflare-Worker",
    },
  });

  if (!userResponse.ok) return null;
  return await userResponse.json();
}

    // Serve the dashboard page
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      if (!dashboardHtml) return new Response("Dashboard not found", { status: 404 });
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Login - Redirect to GitHub OAuth
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

    // GitHub OAuth Callback
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "NotesApp",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URI,
        }),
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

    // Fetch Approved Notes
    if (url.pathname === "/notes") {
      if (!token) return new Response("Missing token", { status: 401 });

      const repo = "hiplitehehe/notes";
      const file = "j.json";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/${file}`;

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "NotesApp" },
      });

      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await fetchNotes.json();
      const notes = JSON.parse(atob(fileData.content));

      // Show only approved notes
      const approvedNotes = notes.filter(note => note.approved);

      return new Response(JSON.stringify(approvedNotes), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 200,
      });
    }

    // Make a New Note
    if (url.pathname === "/make-note" && request.method === "POST") {
      if (!token) return new Response("Unauthorized", { status: 401 });

      const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "NotesApp" },
      });

      const userData = await userResponse.json();
      if (!userData.login) return new Response("Invalid token", { status: 401 });

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing title or content", { status: 400 });

      const repo = "hiplitehehe/notes";
      const file = "j.json";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/${file}`;

      let notes = [];
      let sha = "";

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "NotesApp" },
      });

      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        notes = JSON.parse(atob(fileData.content));
        sha = fileData.sha;
      }

      notes.push({ title: body.title, content: body.content, approved: false });

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "NotesApp",
        },
        body: JSON.stringify({
          message: `Added note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha,
        }),
      });

      if (!updateResponse.ok) return new Response("Failed to create note", { status: 500 });

      return new Response(JSON.stringify({ message: "Note created!" }), { status: 200 });
    }

    // Approve Note (Admin Only)
    if (url.pathname === "/approve" && request.method === "POST") {
      if (!token) return new Response("Unauthorized", { status: 401 });

      if (token !== env.ADMIN_TOKEN) {
        return new Response("Permission denied", { status: 403 });
      }

      const body = await request.json();
      if (!body.title) return new Response("Missing note title", { status: 400 });

      const repo = "hiplitehehe/notes";
      const file = "j.json";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/${file}`;

      let notes = [];
      let sha = "";

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "NotesApp" },
      });

      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        notes = JSON.parse(atob(fileData.content));
        sha = fileData.sha;
      }

      const note = notes.find(n => n.title === body.title);
      if (!note) return new Response("Note not found", { status: 404 });

      note.approved = true;

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "NotesApp",
        },
        body: JSON.stringify({
          message: `Approved note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha,
        }),
      });

      if (!updateResponse.ok) return new Response("Failed to approve note", { status: 500 });

      return new Response(JSON.stringify({ message: `Note "${body.title}" approved!` }), { status: 200 });
    }

    // Admin Page
    if (url.pathname === "/admin") {
      if (!token) return new Response("Unauthorized", { status: 401 });

      if (token !== env.ADMIN_TOKEN) {
        return new Response("Permission denied", { status: 403 });
      }

      const adminHtml = await env.HTML_FILES.get("admin.html");
      if (!adminHtml) return new Response("Admin page not found", { status: 404 });

      return new Response(adminHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
