
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
</head>
<body>
    <h1>Dashboard</h1>

    <div id="loginSection">
        <button onclick="login()">Login with GitHub</button>
        <p id="userStatus">Not logged in</p>
    </div>

    <h2>Create Note</h2>
    <input type="text" id="noteTitle" placeholder="Title">
    <textarea id="noteContent" placeholder="Content"></textarea>
    <button onclick="makeNote()">Submit</button>

    <h2>Notes</h2>
    <ul id="notesList">Loading...</ul>

    <script>
        let loggedInUser = "Guest";

        async function login() {
            window.location.href = "/login";
        }

        async function checkUser() {
            const response = await fetch("/user");
            loggedInUser = await response.text();
            console.log("Logged in as:", loggedInUser);

            document.getElementById("userStatus").innerText = 
                loggedInUser !== "Guest" ? `Logged in as ${loggedInUser}` : "Not logged in";

            fetchNotes();
        }

        async function fetchNotes() {
            const response = await fetch("/notes");
            if (!response.ok) {
                document.getElementById("notesList").innerHTML = "Failed to load notes.";
                return;
            }
            const notes = await response.json();
            const list = document.getElementById("notesList");
            list.innerHTML = "";

            notes.forEach((note, index) => {
                if (!note.approved && loggedInUser !== "Hiplitehehe") return; // Hide unapproved notes

                const li = document.createElement("li");
                li.innerHTML = `<strong>${note.title}</strong><br>
                                <em>${note.content}</em><br>
                                <small>By: ${note.author}</small>`;

                if (!note.approved && loggedInUser === "Hiplitehehe") {
                    li.innerHTML += `<br><button onclick="approveNote(${index})">Approve</button>`;
                }
                list.appendChild(li);
            });
        }

        async function makeNote() {
            const title = document.getElementById("noteTitle").value;
            const content = document.getElementById("noteContent").value;
            if (!title || !content) {
                alert("Title and content required");
                return;
            }

            const response = await fetch("/make-note", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content }),
            });

            alert(await response.text());
            document.getElementById("noteTitle").value = "";
            document.getElementById("noteContent").value = "";
            fetchNotes();  // Refresh notes
        }

        async function approveNote(noteId) {
            const response = await fetch(`/approve/${noteId}`, { method: "POST" });
            alert(await response.text());
            fetchNotes();  // Refresh notes
        }

        window.onload = checkUser;
    </script>
</body>
</html>
