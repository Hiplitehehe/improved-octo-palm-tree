
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      return Response.redirect(
        `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
        302
      );
    }

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
      if (!tokenData.access_token) {
        return new Response(`Error: ${JSON.stringify(tokenData)}`, { status: 400 });
      }

      return Response.redirect(
        `https://my-worker.hiplitehehe.workers.dev/dashboard?token=${tokenData.access_token}`,
        302
      );
    }

    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/notes") {
      return await fetchNotes(env);
    }

    if (url.pathname === "/make-note") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

      const token = authHeader.split(" ")[1];

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing title or content", { status: 400 });

      return await saveNote(env, body.title, body.content, false);
    }

    if (url.pathname === "/approve") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

      const token = authHeader.split(" ")[1];

      if (token !== env.ADMIN_TOKEN) return new Response("Permission Denied", { status: 403 });

      const body = await request.json();
      if (!body.title) return new Response("Missing title", { status: 400 });

      return await approveNote(env, body.title);
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function fetchNotes(env) {
  try {
    const response = await fetch("https://api.github.com/repos/hiplitehehe/notes/contents/j.json", {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    const approvedNotes = notes.filter(note => note.approved);

    return new Response(JSON.stringify(approvedNotes), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}

async function saveNote(env, title, content, approved) {
  try {
    const response = await fetch("https://api.github.com/repos/hiplitehehe/notes/contents/j.json", {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    notes.push({ title, content, approved });

    const updateResponse = await fetch("https://api.github.com/repos/hiplitehehe/notes/contents/j.json", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "User-Agent": "Cloudflare-Worker",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: `Added note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: data.sha
      })
    });

    if (!updateResponse.ok) throw new Error("Failed to save note");

    return new Response(JSON.stringify({ message: `Note "${title}" created!` }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}

async function approveNote(env, title) {
  try {
    const response = await fetch("https://api.github.com/repos/hiplitehehe/notes/contents/j.json", {
      headers: { "User-Agent": "Cloudflare-Worker" }
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    const noteIndex = notes.findIndex(note => note.title === title);
    if (noteIndex === -1) return new Response("Note not found", { status: 404 });

    notes[noteIndex].approved = true;

    const updateResponse = await fetch("https://api.github.com/repos/hiplitehehe/notes/contents/j.json", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "User-Agent": "Cloudflare-Worker",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: `Approved note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: data.sha
      })
    });

    if (!updateResponse.ok) throw new Error("Failed to approve note");

    return new Response(JSON.stringify({ message: `Note "${title}" approved!` }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}
