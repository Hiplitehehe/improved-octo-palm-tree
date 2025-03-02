
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the login page
    if (url.pathname === "/login") {
      const loginHtml = await env.HTML_FILES.get("login.html");
      return new Response(loginHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle GitHub OAuth callback
    if (url.pathname === "/callback") {
      const callbackHtml = await env.HTML_FILES.get("callback.html");
      return new Response(callbackHtml, {
        headers: { "Content-Type": "text/html" },
      });
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

    // Serve the dashboard page with dynamic content (create and manage notes)
    if (url.pathname === "/dashboard") {
      const dashboardHtml = await env.HTML_FILES.get("dashboard.html");

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

// Fetch approved notes data from GitHub repository with custom User-Agent
async function fetchNotesData(env) {
  const repo = "hiplitehehe/Notes"; // Replace with your repo name
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
