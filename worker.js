export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the login page
    if (url.pathname === "/login") {
  return Response.redirect(
    `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=repo`,
    302
  );
}

    // Handle GitHub OAuth callback
    if (url.pathname === "/callback") {
      const params = new URLSearchParams(url.search);
      const code = params.get("code");

      if (!code) {
        return new Response("Error: No code received", { status: 400 });
      }

      // Exchange the authorization code for an access token
      try {
        const accessToken = await getGitHubAccessToken(code, env);
        // Store the token in a cookie or another secure storage (e.g., KV store, session)
        const headers = new Headers();
        headers.set("Set-Cookie", `access_token=${accessToken}; HttpOnly; Secure; Path=/;`);

        return new Response("Logged in successfully!", {
          headers,
        });
      } catch (error) {
        return new Response("Error during OAuth exchange", { status: 500 });
      }
    }

    // Serve the notes page with dynamic content
    if (url.pathname === "/notes") {
      const notesHtml = await env.HTML_FILES.get("notes.html");

      // Fetch approved notes data and handle GitHub API errors
      let notesData;
      try {
        notesData = await fetchNotesData(env);
      } catch (error) {
        const errorMessage = `GitHub Error: ${error.message}`;
        return new Response(errorMessage, {
          headers: { "Content-Type": "text/html" },
          status: 500,
        });
      }

      // Create a dynamic list of notes
      let notesList = "<ul>";
      if (notesData.length === 0) {
        notesList = "<p>No approved notes available.</p>";
      } else {
        notesData.forEach(note => {
          notesList += `<li>${note.title}</li>`;
        });
      }
      notesList += "</ul>";

      // Replace the placeholder in the notes HTML template
      const finalHtml = notesHtml.replace("{{notes}}", notesList);

      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve the dashboard page with dynamic content
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");

      // Check if the user is logged in by checking the access token cookie
      const accessToken = getAccessTokenFromCookie(request);

      if (!accessToken) {
        return new Response("You must log in to view the dashboard", {
          status: 401,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Fetch approved notes data and handle GitHub API errors
      let notesData;
      try {
        notesData = await fetchNotesData(env);
      } catch (error) {
        const errorMessage = `GitHub Error: ${error.message}`;
        return new Response(errorMessage, {
          headers: { "Content-Type": "text/html" },
          status: 500,
        });
      }

      // Create a dynamic list of notes
      let notesList = "<ul>";
      if (notesData.length === 0) {
        notesList = "<p>No approved notes available.</p>";
      } else {
        notesData.forEach(note => {
          notesList += `<li>${note.title}</li>`;
        });
      }
      notesList += "</ul>";

      // Replace the placeholder in the dashboard HTML template
      const finalHtml = dashboardHtml.replace("{{notes}}", notesList);

      return new Response(finalHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle the "Make Note" route
    if (url.pathname === "/make-note" && request.method === "POST") {
      const body = await request.json();
      const { title } = body;

      if (!title) {
        return new Response("Missing note title", { status: 400 });
      }

      try {
        const result = await makeNote(env, title);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Function to get GitHub access token using the authorization code
async function getGitHubAccessToken(code, env) {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = `${env.SITE_URL}/callback`;

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description);
  }

  return data.access_token;
}

// Helper function to get access token from cookie
function getAccessTokenFromCookie(request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;

  const match = cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
}

// Fetch approved notes data from GitHub repository with custom User-Agent
async function fetchNotesData(env) {
  const repo = "Hiplitehehe/Notes"; // Replace with your repo name
  const notesFile = "j.json"; // The file containing the notes
  const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

  try {
    // Fetch the notes file from GitHub with authorization token and custom User-Agent
    const response = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`, // Use GitHub token stored in environment variables
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-App/1.0", // Custom User-Agent
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch notes from GitHub: ${response.statusText}`);
    }
    const data = await response.json();

    // Simulate decoding and returning notes
    const notes = JSON.parse(atob(data.content));
    return notes.filter(note => note.approved); // Filter approved notes
  } catch (error) {
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

// Function to make a note and save it to GitHub
async function makeNote(env, title) {
  const repo = "hiplitehehe/Notes"; // Replace with your repo name
  const notesFile = "j.json"; // The file containing the notes
  const notesUrl = `https://api.github.com/repos/${repo}/contents/${notesFile}`;

  try {
    // Fetch the notes file from GitHub
    const response = await fetch(notesUrl, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`, // Use GitHub token stored in environment variables
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-App/1.0", // Custom User-Agent
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch notes from GitHub: ${response.statusText}`);
    }

    const data = await response.json();
    const notes = JSON.parse(atob(data.content)); // Decode the notes

    // Add the new note
    notes.push({ title, approved: false });

    // Update the notes file on GitHub
    const updateResponse = await fetch(notesUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Added new note: ${title}`,
        content: btoa(JSON.stringify(notes, null, 2)),
        sha: data.sha, // Required for updating the file
      }),
    });

    if (!updateResponse.ok) {
      throw new Error("Failed to update notes file on GitHub");
    }

    return { message: "Note created successfully!", title };
  } catch (error) {
    throw new Error(`Failed to create note: ${error.message}`);
  }
}
