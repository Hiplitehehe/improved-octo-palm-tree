
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔹 Serve Dashboard Page
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");
      return new Response(dashboardHtml, {
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
          "Accept": "application/json",
          "User-Agent": "Cloudflare-Worker",
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

    // 🔹 Fetch Notes (Only Show Approved for Non-Admins)
    if (url.pathname === "/notes") {
      const token = url.searchParams.get("token");
      const isAdmin = await verifyAdmin(token, env);
      return fetchNotes(env, isAdmin);
    }

    // 🔹 Make a Note
    if (url.pathname === "/make-note" && request.method === "POST") {
      const token = request.headers.get("Authorization")?.split(" ")[1];
      if (!token) return new Response("Unauthorized", { status: 401 });

      const body = await request.json();
      if (!body.title || !body.content) return new Response("Missing data", { status: 400 });

      return makeNote(env, body.title, body.content);
    }

    // 🔹 Approve Note (Admins Only)
    if (url.pathname === "/approve" && request.method === "POST") {
      const token = request.headers.get("Authorization")?.split(" ")[1];
      if (!token) return new Response("Unauthorized", { status: 401 });

      const isAdmin = await verifyAdmin(token, env);
      if (!isAdmin) return new Response("Permission denied", { status: 403 });

      const body = await request.json();
      if (!body.title) return new Response("Missing note title", { status: 400 });

      return approveNote(env, body.title);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// 🔹 Function to Fetch Notes
async function fetchNotes(env, isAdmin) {
  try {
    const response = await fetch(`https://api.github.com/repos/hiplitehehe/notes/contents/j.json`, {
      headers: {
        "User-Agent": "Cloudflare-Worker",
        "Accept": "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    return new Response(JSON.stringify(isAdmin ? notes : notes.filter(note => note.approved)), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// 🔹 Function to Create a Note
async function makeNote(env, title, content) {
  try {
    const response = await fetch(`https://api.github.com/repos/hiplitehehe/notes/contents/j.json`, {
      headers: {
        "User-Agent": "Cloudflare-Worker",
        "Accept": "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    notes.push({ title, content, approved: false });

    return updateNotes(env, notes, `New note: ${title}`);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// 🔹 Function to Approve a Note
async function approveNote(env, title) {
  try {
    const response = await fetch(`https://api.github.com/repos/hiplitehehe/notes/contents/j.json`, {
      headers: {
        "User-Agent": "Cloudflare-Worker",
        "Accept": "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

    const data = await response.json();
    const notes = JSON.parse(atob(data.content));

    const note = notes.find(n => n.title === title);
    if (!note) return new Response("Note not found", { status: 404 });

    note.approved = true;
    return updateNotes(env, notes, `Approved note: ${title}`);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// 🔹 Function to Update Notes in GitHub
async function updateNotes(env, notes, commitMessage) {
  const notesUrl = `https://api.github.com/repos/hiplitehehe/notes/contents/j.json`;

  const fileResponse = await fetch(notesUrl, {
    headers: {
      "User-Agent": "Cloudflare-Worker",
      "Accept": "application/vnd.github.v3+json",
    },
  });

  if (!fileResponse.ok) throw new Error(`GitHub API error: ${fileResponse.statusText}`);

  const fileData = await fileResponse.json();
  const updatedContent = btoa(JSON.stringify(notes, null, 2));

  const updateResponse = await fetch(notesUrl, {
    method: "PUT",
    headers: {
      "User-Agent": "Cloudflare-Worker",
      "Accept": "application/vnd.github.v3+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: updatedContent,
      sha: fileData.sha,
    }),
  });

  if (!updateResponse.ok) throw new Error("Failed to update notes");

  return new Response(JSON.stringify({ message: "Note updated successfully" }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

// 🔹 Function to Verify Admin
async function verifyAdmin(token, env) {
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Cloudflare-Worker",
      },
    });

    const userData = await userResponse.json();
    return userData.login && token === env.ADMIN_GITHUB_TOKEN; // Only admin token can approve
  } catch {
    return false;
  }
}
