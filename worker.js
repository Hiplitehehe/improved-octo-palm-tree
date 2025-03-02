
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔹 Handle user login
    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

    // 🔹 Handle OAuth callback
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
          code
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });
      }

      return new Response(JSON.stringify({ token: tokenData.access_token }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Get approved notes
    if (url.pathname === "/notes") {
      const repo = "hiplitehehe/notes";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/j.json`;

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      });

      if (!fetchNotes.ok) return new Response("Failed to fetch notes", { status: 500 });

      const fileData = await fetchNotes.json();
      const notes = JSON.parse(atob(fileData.content));

      // Filter only approved notes
      return new Response(JSON.stringify(notes.filter(n => n.approved)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🔹 Create a new note
    if (url.pathname === "/make-note" && request.method === "POST") {
      const body = await request.json();
      if (!body.title || !body.content) return new Response("Title and content required", { status: 400 });

      const repo = "hiplitehehe/notes";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/j.json`;

      let notes = [];
      let sha = null;

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
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
        },
        body: JSON.stringify({
          message: `New note: ${body.title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha,
        }),
      });

      if (!updateResponse.ok) {
        return new Response("Failed to add note", { status: 500 });
      }

      return new Response("Note added!", { status: 200 });
    }

    // 🔹 Approve a note (Check token permissions)
    if (url.pathname.startsWith("/approve/") && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const token = authHeader.split(" ")[1];

      // Verify GitHub user permissions using token
      const userResponse = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "Cloudflare-Worker" },
      });

      const userData = await userResponse.json();
      if (!userData.login) return new Response("Invalid token", { status: 401 });

      const adminCheck = await fetch(`https://api.github.com/repos/hiplitehehe/notes/collaborators/${userData.login}/permission`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "Cloudflare-Worker" },
      });

      const permissionData = await adminCheck.json();
      if (permissionData.permission !== "admin" && permissionData.permission !== "write") {
        return new Response("Permission denied", { status: 403 });
      }

      // Approve note
      const noteId = parseInt(url.pathname.split("/")[2]);
      const repo = "hiplitehehe/notes";
      const notesUrl = `https://api.github.com/repos/${repo}/contents/j.json`;

      let notes = [];
      let sha = null;

      const fetchNotes = await fetch(notesUrl, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
      });

      if (fetchNotes.ok) {
        const fileData = await fetchNotes.json();
        notes = JSON.parse(atob(fileData.content));
        sha = fileData.sha;
      }

      if (!notes[noteId]) return new Response("Note not found", { status: 404 });

      notes[noteId].approved = true;

      const updateResponse = await fetch(notesUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Approved note: ${notes[noteId].title}`,
          content: btoa(JSON.stringify(notes, null, 2)),
          sha,
        }),
      });

      if (!updateResponse.ok) {
        return new Response("Failed to approve note", { status: 500 });
      }

      return new Response(`Note "${notes[noteId].title}" approved!`, { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
