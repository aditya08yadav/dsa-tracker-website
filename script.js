// --- Backend API Configuration ---
const BACKEND_API_URL = 'http://127.0.0.1:5001'; // Your Flask backend URL

// --- Global User State ---
let currentUserId = null;
let currentUsername = null;

// --- Helper Functions for Authentication ---
function saveAuthToLocalStorage(userId, username) {
    localStorage.setItem('dsaTrackerUserId', userId);
    localStorage.setItem('dsaTrackerUsername', username);
    currentUserId = userId;
    currentUsername = username;
    updateAuthUI(); // Update UI immediately after saving
    console.log("Auth saved to localStorage:", {userId, username}); // Debug log
}

function clearAuthFromLocalStorage() {
    console.log("Attempting to clear authentication from localStorage..."); // Debug log
    localStorage.removeItem('dsaTrackerUserId');
    localStorage.removeItem('dsaTrackerUsername');
    console.log("localStorage items removed. New state:", {userId: localStorage.getItem('dsaTrackerUserId'), username: localStorage.getItem('dsaTrackerUsername')}); // Debug log
    currentUserId = null;
    currentUsername = null;
    updateAuthUI(); // Update UI immediately after clearing
    // Reload problems/notes to show empty list for logged out user
    displayProblems([]); // Pass empty array for immediate visual clear
    updateStatistics(); // Update stats for empty list
    updateTopicBreakdown(); // Update topic breakdown for empty list
    displayClassNotes([]); // Pass empty array for immediate visual clear
    alert("Logged out successfully!");
    showPage('home-section'); // Redirect to home on logout
}

// Function to get common headers for authenticated requests
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (currentUserId) {
        headers['User-Id'] = currentUserId; // Add User-Id header
    }
    return headers;
}

// --- Register User Function ---
async function registerUser(username, password) {
    const messageArea = document.getElementById('register-message');
    messageArea.textContent = '';
    messageArea.classList.remove('success', 'error');
    try {
        const response = await fetch(`${BACKEND_API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            messageArea.textContent = result.message;
            messageArea.classList.add('success');
            alert(result.message);
            return true;
        } else {
            messageArea.textContent = result.message;
            messageArea.classList.add('error');
            alert(`Error: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('Error during registration fetch:', error);
        messageArea.textContent = 'Network error or server unavailable.';
        messageArea.classList.add('error');
        alert('Registration failed due to network error or server issue.');
        return false;
    }
}

// --- Login User Function ---
async function loginUser(username, password) {
    const messageArea = document.getElementById('login-message');
    messageArea.textContent = '';
    messageArea.classList.remove('success', 'error');
    try {
        const response = await fetch(`${BACKEND_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            saveAuthToLocalStorage(result.userId, result.username);
            messageArea.textContent = result.message;
            messageArea.classList.add('success');
            alert(result.message);
            window.location.reload(); // Reloads page to fully refresh UI and data
            return true;
        } else {
            messageArea.textContent = result.message;
            messageArea.classList.add('error');
            alert(`Error: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('Error during login fetch:', error);
        messageArea.textContent = 'Network error or server unavailable.';
        messageArea.classList.add('error');
        alert('Login failed due to network error or server issue.');
        return false;
    }
}


// --- Functions to Interact with Backend for Problems ---

async function loadProblems() {
    if (!currentUserId) {
        console.log('No user logged in, not loading problems.');
        return [];
    }
    try {
        const response = await fetch(`${BACKEND_API_URL}/problems`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('Authentication failed when loading problems. Clearing session.');
                alert('Session expired or unauthorized. Please log in again.');
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const problems = await response.json();
        console.log('Problems loaded from backend (for current user):', problems);
        return problems;
    } catch (error) {
        console.error('Error loading problems from backend:', error);
        if (error.message.includes('401')) {
            console.log('Not authorized to load problems. Please log in.');
        } else {
            alert('Could not load problems from the server. Is the backend running? Check console for details.');
        }
        return [];
    }
}

async function addProblemToBackend(problemData) {
    if (!currentUserId) {
        alert('Please log in to add problems.');
        return false;
    }
    problemData.userId = currentUserId;
    // The `isPublic` property is now always true as per your request
    problemData.isPublic = true; // IMPORTANT CHANGE: Hardcoding to true

    try {
        const response = await fetch(`${BACKEND_API_URL}/problems`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(problemData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again to add problems.');
                return false;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Problem added to backend:', result);

        allProblems = await loadProblems();
        displayProblems();
        updateStatistics();
        updateTopicBreakdown();
        return true;
    } catch (error) {
        console.error('Error adding new problem to backend:', error);
        alert('Failed to add new problem. Make sure you are logged in. Check console for details.');
        return false;
    }
}

async function syncAllProblemsToBackend(problemsList) {
    if (!currentUserId) {
        alert('Please log in to update problems.');
        return false;
    }
    const userProblems = problemsList.filter(p => p.userId === currentUserId);

    try {
        const response = await fetch(`${BACKEND_API_URL}/problems`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userProblems)
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again to update problems.');
                return false;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Problems list synced to backend:', result);

        allProblems = await loadProblems();
        displayProblems();
        updateStatistics();
        updateTopicBreakdown();
        return true;
    } catch (error) {
        console.error('Error syncing problems list to backend:', error);
        alert('Failed to sync problem changes. Make sure you are logged in. Check console for details.');
        return false;
    }
}

async function deleteProblemOnBackend(problemId) {
    if (!currentUserId) {
        alert('Please log in to delete problems.');
        return false;
    }
    try {
        const response = await fetch(`${BACKEND_API_URL}/problems/${problemId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again to delete problems.');
                return false;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Problem deleted from backend:', result);

        allProblems = await loadProblems();
        displayProblems();
        updateStatistics();
        updateTopicBreakdown();
        return true;
    } catch (error) {
        console.error('Error deleting problem:', error);
        alert('Could not delete problem. Make sure you are logged in. Check console for details.');
        return false;
    }
}


// --- Functions to Interact with Backend for Class Notes ---

async function loadClassNotes() {
    if (!currentUserId) {
        console.log('No user logged in, not loading notes.');
        return [];
    }
    try {
        const response = await fetch(`${BACKEND_API_URL}/notes`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again to view notes.');
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const notes = await response.json();
        console.log('Notes loaded from backend (for current user):', notes);
        return notes;
    } catch (error) {
        console.error('Error loading notes from backend:', error);
        if (error.message.includes('401')) {
            console.log('Not authorized to load notes. Please log in.');
        } else {
            alert('Could not load notes from the server. Is the backend running? Check console for details.');
        }
        return [];
    }
}

async function addOrSyncNotesToBackend(notesDataOrList) {
    if (!currentUserId) {
        alert('Please log in to add notes.');
        return false;
    }
    if (!Array.isArray(notesDataOrList)) {
        notesDataOrList.userId = currentUserId;
    }
    const userNotes = Array.isArray(notesDataOrList) ?
        notesDataOrList.filter(n => n.userId === currentUserId) :
        [notesDataOrList];

    try {
        const response = await fetch(`${BACKEND_API_URL}/notes`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userNotes)
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again to add/update notes.');
                return false;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Backend response for note sync:', result);

        allClassNotes = await loadClassNotes();
        displayClassNotes();
        return true;
    } catch (error) {
        console.error('Error adding/updating note to backend:', error);
        alert('Could not save note. Make sure you are logged in. Check console for details.');
        return false;
    }
}

async function deleteNoteOnBackend(noteId) {
    if (!currentUserId) {
        alert('Please log in to delete notes.');
        return false;
    }
    try {
        const response = await fetch(`${BACKEND_API_URL}/notes/${noteId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again to delete notes.');
                return false;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('Note deleted from backend:', result);

        allClassNotes = await loadClassNotes();
        displayClassNotes();
        return true;
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Could not delete note. Make sure you are logged in. Check console for details.');
        return false;
    }
}

// NEW: Fetch and Display Public Problems
// async function fetchPublicProblems() {
//     console.log("Attempting to load public problems...");
//     try {
//         // This endpoint no longer filters by is_public if we want all problems to be public
//         // However, the existing /public_problems endpoint specifically fetches is_public=True
//         // For 'all problems visible to everyone', we might need a new backend endpoint
//         // or ensure all problems are set to public via the backend migration route.
//         const response = await fetch(`${BACKEND_API_URL}/public_problems`); // This currently fetches only is_public=True
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         const publicProblems = await response.json();
//         console.log('Public problems loaded from backend:', publicProblems);
//         return publicProblems;
//     } catch (error) {
//         console.error('Error loading public problems from backend:', error);
//         alert('Could not load public problems from the server. Check console for details.');
//         return [];
//     }
// }

// function displayPublicProblems(publicProblemsToDisplay) {
//     console.log("Displaying public problems...", publicProblemsToDisplay);
//     const publicProblemsContainer = document.getElementById('public-problems-container');
//     publicProblemsContainer.innerHTML = '';

//     if (!publicProblemsToDisplay || publicProblemsToDisplay.length === 0) {
//         publicProblemsContainer.innerHTML = '<p>No public problems shared yet.</p>';
//         return;
//     }

//     publicProblemsToDisplay.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());

//     publicProblemsToDisplay.forEach(problem => {
//         const problemCard = document.createElement('div');
//         problemCard.classList.add('problem-card');
//         problemCard.classList.add('public-problem-card');

//         problemCard.innerHTML = `
//             <div class="public-badge">PUBLIC</div>
//             <h3 class="problem-title-flex">${problem.name}
//                 ${problem.solved ? '<span class="solved-indicator">✅</span>' : ''}
//             </h3>
//             <p class="public-author">By: ${problem.username || 'Unknown User'}</p>
//             <p><strong>Topic:</strong> ${problem.topic}</p>
//             <p><strong>Difficulty:</strong> ${problem.difficulty}</p>
//             ${problem.link ? `<p><strong>Link:</strong> <a href="${problem.link}" target="_blank">View Problem</a></p>` : ''}
//             ${problem.timeComplexity ? `<p><strong>Time Complexity:</strong> ${problem.timeComplexity}</p>` : ''}
//             ${problem.spaceComplexity ? `<p><strong>Space Complexity:</strong> ${problem.spaceComplexity}</p>` : ''}
//             ${problem.notes ? `<p class="notes-preview"><strong>Notes:</strong> ${problem.notes}</p>` : ''}
//             <div class="footer-info">
//                 <span>Added: ${new Date(problem.addedDate).toLocaleDateString()}</span>
//             </div>
//             `;
//         publicProblemsContainer.appendChild(problemCard);
//     });
// }

// --- NEW: Fetch and Display Public Problems (UPDATED) ---
async function fetchPublicProblems() {
    console.log("Attempting to load public problems...");
    try {
        const response = await fetch(`${BACKEND_API_URL}/public_problems`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const publicProblems = await response.json();
        console.log('Public problems loaded from backend:', publicProblems);
        // Directly call display function with the fetched data
        displayPublicProblems(publicProblems); // Ensure this is called with the actual data
        return publicProblems;
    } catch (error) {
        console.error('Error loading public problems from backend:', error);
        alert('Could not load public problems from the server. Check console for details.');
        // Ensure display is cleared if there's an error
        displayPublicProblems([]);
        return [];
    }
}

function displayPublicProblems(publicProblemsToDisplay) {
    console.log("Displaying public problems...", publicProblemsToDisplay);
    const publicProblemsContainer = document.getElementById('public-problems-container');

    // Always clear the container first
    publicProblemsContainer.innerHTML = ''; 

    if (!publicProblemsToDisplay || publicProblemsToDisplay.length === 0) {
        publicProblemsContainer.innerHTML = '<p>No public problems shared yet.</p>';
        return; // Exit if no problems to display
    }

    // Sort public problems by addedDate (newest first)
    publicProblemsToDisplay.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());

    publicProblemsToDisplay.forEach(problem => {
        const problemCard = document.createElement('div');
        problemCard.classList.add('problem-card');
        problemCard.classList.add('public-problem-card');

        problemCard.innerHTML = `
            <div class="public-badge">PUBLIC</div>
            <h3 class="problem-title-flex">${problem.name}
                ${problem.solved ? '<span class="solved-indicator">✅</span>' : ''}
            </h3>
            <p class="public-author">By: ${problem.username || 'Unknown User'}</p>
            <p><strong>Topic:</strong> ${problem.topic}</p>
            <p><strong>Difficulty:</strong> ${problem.difficulty}</p>
            ${problem.link ? `<p><strong>Link:</strong> <a href="${problem.link}" target="_blank">View Problem</a></p>` : ''}
            ${problem.timeComplexity ? `<p><strong>Time Complexity:</strong> ${problem.timeComplexity}</p>` : ''}
            ${problem.spaceComplexity ? `<p><strong>Space Complexity:</strong> ${problem.spaceComplexity}</p>` : ''}
            ${problem.notes ? `<p class="notes-preview"><strong>Notes:</strong> ${problem.notes}</p>` : ''}
            <div class="footer-info">
                <span>Added: ${new Date(problem.addedDate).toLocaleDateString()}</span>
            </div>
            `;
        publicProblemsContainer.appendChild(problemCard);
    });
}


// --- Global Data Arrays ---
let allProblems = [];
let allClassNotes = [];


// --- UI Update Functions (for my-progress and class-notes) ---
function displayProblems(problemsToDisplay = allProblems) {
    const problemsContainer = document.getElementById('problems-container');
    problemsContainer.innerHTML = '';

    if (problemsToDisplay.length === 0) {
        problemsContainer.innerHTML = '<p>No matching problems found. Try a different search!</p>';
        return;
    }

    problemsToDisplay.forEach(problem => {
        const problemCard = document.createElement('div');
        problemCard.classList.add('problem-card');
        if (problem.solved) {
            problemCard.classList.add('solved');
        }

        problemCard.innerHTML = `
            <h3 class="problem-title-flex">${problem.name}
                <button class="flag-btn star-flag ${problem.important ? 'important' : ''}" data-problem-id="${problem.id}" data-flag-type="important">★</button>
            </h3>
            <div class="solved-toggle-container">
                <input type="checkbox" id="solved-toggle-${problem.id}" class="solved-toggle" data-problem-id="${problem.id}" ${problem.solved ? 'checked' : ''}>
                <label for="solved-toggle-${problem.id}">Solved</label>
            </div>
            <p><strong>Topic:</strong> ${problem.topic}</p>
            <p><strong>Difficulty:</strong> ${problem.difficulty}</p>
            ${problem.link ? `<p><strong>Link:</strong> <a href="${problem.link}" target="_blank">View Problem</a></p>` : ''}
            ${problem.timeComplexity ? `<p><strong>Time Complexity:</strong> ${problem.timeComplexity}</p>` : ''}
            ${problem.spaceComplexity ? `<p><strong>Space Complexity:</strong> ${problem.spaceComplexity}</p>` : ''}
            ${problem.notes ? `<p class="notes-preview"><strong>Notes:</strong> ${problem.notes}</p>` : ''}
            <div class="footer-info">
                <span>Added: ${new Date(problem.addedDate).toLocaleDateString()}</span>
            </div>
            <button class="delete-btn" data-problem-id="${problem.id}">🗑️ Delete</button>
            <button class="toggle-solution-btn" data-problem-id="${problem.id}">${problem.solutionCode && problem.solutionCode.trim() !== '' ? 'View/Edit Solution' : 'Add Solution'}</button>
            <div class="solution-editor-container hidden" id="solution-container-${problem.id}">
                <p><h4>Your Solution:</h4>
                <textarea class="solution-textarea" data-problem-id="${problem.id}" placeholder="Paste your code here...">${problem.solutionCode || ''}</textarea>
                <button class="save-solution-btn" data-problem-id="${problem.id}">Save Solution</button>
            </div>
        `;
        problemsContainer.appendChild(problemCard);
    });
}

function updateStatistics() {
    const totalProblems = allProblems.length;
    const solvedProblems = allProblems.filter(problem => problem.solved).length;
    const importantProblems = allProblems.filter(problem => problem.important).length;

    let completionPercentage = 0;
    if (totalProblems > 0) {
        completionPercentage = (solvedProblems / totalProblems) * 100;
    }

    document.getElementById('total-problems').textContent = totalProblems;
    document.getElementById('solved-problems').textContent = solvedProblems;
    document.getElementById('important-problems').textContent = importantProblems;
    document.getElementById('completion-percentage').textContent = completionPercentage.toFixed(1) + '%';
}

function updateTopicBreakdown() {
    const topicBreakdownContainer = document.getElementById('topic-breakdown-container');
    topicBreakdownContainer.innerHTML = '';

    const topicStats = new Map();
    allProblems.forEach(problem => {
        const topic = problem.topic || 'Uncategorized';
        if (!topicStats.has(topic)) {
            topicStats.set(topic, { total: 0, solved: 0 });
        }
        const stats = topicStats.get(topic);
        stats.total++;
        if (problem.solved) {
            stats.solved++;
        }
    });

    if (topicStats.size === 0) {
        topicBreakdownContainer.innerHTML = '<p>Add problems to see topic breakdown.</p>';
        return;
    }

    const sortedTopics = Array.from(topicStats.keys()).sort();

    sortedTopics.forEach(topic => {
        const stats = topicStats.get(topic);
        const percentage = stats.total > 0 ? (stats.solved / stats.total) * 100 : 0;

        const topicCard = document.createElement('div');
        topicCard.classList.add('topic-card');
        topicCard.innerHTML = `
            <h3>${topic}</h3>
            <p>Solved: ${stats.solved} / ${stats.total}</p>
            <div class="topic-progress-bar">
                <div class="topic-progress-bar-fill" style="width: ${percentage.toFixed(1)}%;"></div>
            </div>
            <p>${percentage.toFixed(1)}% Complete</p>
        `;
        topicBreakdownContainer.appendChild(topicCard);
    });
}

function displayClassNotes() {
    const notesContainer = document.getElementById('notes-container');
    notesContainer.innerHTML = '';

    if (allClassNotes.length === 0) {
        notesContainer.innerHTML = '<p>No notes added yet. Use the form above to get started!</p>';
        return;
    }

    allClassNotes.forEach(note => {
        const noteCard = document.createElement('div');
        noteCard.classList.add('note-card');
        noteCard.innerHTML = `
            <h3>${note.title}</h3>
            <p><strong>Topic:</strong> ${note.topic}</p>
            ${note.link ? `<p><strong>Link:</strong> <a href="${note.link}" target="_blank" class="view-note-link">View Note PDF</a></p>` : ''}
            ${note.remarks ? `<p class="remarks-preview"><strong>Remarks:</strong> ${note.remarks}</p>` : ''}
            <div class="footer-info">
                <span>Added: ${new Date(note.addedDate).toLocaleDateString()}</span>
            </div>
            <button class="delete-note-btn" data-note-id="${note.id}">🗑️ Delete</button>
        `;
        notesContainer.appendChild(noteCard);
    });
}

// --- Authentication UI Functions ---
function updateAuthUI() {
    console.log("updateAuthUI called. currentUserId:", currentUserId);
    const userInfoBar = document.getElementById('user-info-bar');
    const loggedInUsernameSpan = document.getElementById('logged-in-username');
    const loginLink = document.querySelector('a[data-page="login-section"]');
    const registerLink = document.querySelector('a[data-page="register-section"]');

    if (currentUserId && currentUsername) {
        userInfoBar.classList.remove('hidden');
        loggedInUsernameSpan.textContent = currentUsername;
        if (loginLink) loginLink.classList.add('hidden');
        if (registerLink) registerLink.classList.add('hidden');
        console.log("UI updated: User is logged in.");
    } else {
        userInfoBar.classList.add('hidden');
        loggedInUsernameSpan.textContent = '';
        if (loginLink) loginLink.classList.remove('hidden');
        if (registerLink) registerLink.classList.remove('hidden');
        console.log("UI updated: User is logged out.");
    }
}

// --- Page Navigation Logic (Moved outside DOMContentLoaded for global access) ---
const navLinks = document.querySelectorAll('.nav-link');
const pageSections = document.querySelectorAll('.page-section');

function showPage(pageId) {
    pageSections.forEach(section => { section.classList.add('hidden'); });
    const activeSection = document.getElementById(pageId);
    if (activeSection) { activeSection.classList.remove('hidden'); }
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId) { link.classList.add('active'); }
    });

    if (pageId === 'my-progress-section') {
        displayProblems(); updateStatistics(); updateTopicBreakdown();
        const searchInput = document.getElementById('search-input');
        if (searchInput) { searchInput.value = ''; displayProblems(); }
    } else if (pageId === 'class-notes-section') {
        displayClassNotes();
    } else if (pageId === 'register-section') {
        const messageArea = document.getElementById('register-message');
        if (messageArea) { messageArea.textContent = ''; messageArea.classList.remove('success', 'error'); }
        const registerForm = document.getElementById('user-register-form');
        if (registerForm) registerForm.reset();
    } else if (pageId === 'login-section') {
        const messageArea = document.getElementById('login-message');
        if (messageArea) { messageArea.textContent = ''; messageArea.classList.remove('success', 'error'); }
        const loginForm = document.getElementById('user-login-form');
        if (loginForm) loginForm.reset();
    } else if (pageId === 'shared-problems-section') {
        fetchPublicProblems(); // Make sure this fetches *all* problems if that's the desired behavior
    }
}


// --- App Initialization Function ---
async function initializeApp() {
    console.log("initializeApp started.");

    const storedUserId = localStorage.getItem('dsaTrackerUserId');
    const storedUsername = localStorage.getItem('dsaTrackerUsername');
    if (storedUserId && storedUsername) {
        currentUserId = storedUserId;
        currentUsername = storedUsername;
        console.log(`User ${currentUsername} (${currentUserId}) reloaded from localStorage.`);
    } else {
        console.log("No user logged in on start.");
    }

    allProblems = await loadProblems();
    allClassNotes = await loadClassNotes();

    displayProblems();
    updateStatistics();
    updateTopicBreakdown();
    displayClassNotes();

    // Ensure showPage is accessible here
    showPage('home-section');
    updateAuthUI();

    console.log("script.js is loaded and running!");
    console.log("Problems loaded on start:", allProblems);
    console.log("Class Notes loaded on start:", allClassNotes);
    console.log("Current user:", currentUsername, currentUserId);
}


// --- Event Listeners and Initial Call inside DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Call initializeApp after DOM is fully loaded and all functions are defined
    initializeApp();

    // Add event listeners to forms and buttons
    const addProblemForm = document.querySelector('#add-problem-form form');
    if (addProblemForm) {
        addProblemForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const problemName = document.getElementById('problem-name').value;
            const problemLink = document.getElementById('problem-link').value;
            const topic = document.getElementById('topic').value;
            let difficulty = '';
            const difficultyRadios = document.getElementsByName('difficulty');
            for (const radio of difficultyRadios) { if (radio.checked) { difficulty = radio.value; break; } }
            const timeComplexity = document.getElementById('time-complexity').value;
            const spaceComplexity = document.getElementById('space-complexity').value;
            const notes = document.getElementById('notes').value;
            const solvedFromForm = document.getElementById('solved').checked;
            // No need to get isPublic from form, it's hardcoded to true now.
            const newProblem = { name: problemName, link: problemLink, topic: topic, difficulty: difficulty, timeComplexity: timeComplexity, spaceComplexity: spaceComplexity, notes: notes, solved: solvedFromForm, important: false, solutionCode: '', addedDate: new Date().toISOString() }; // isPublic added below

            // Hardcode isPublic to true for all new problems
            newProblem.isPublic = true;

            const success = await addProblemToBackend(newProblem);
            if (success) { addProblemForm.reset(); alert('Problem added successfully to server!'); } else { alert('Failed to add problem. Check console for errors.'); }
        });
    } else { console.error("addProblemForm not found!"); }

    const problemsContainer = document.getElementById('problems-container');
    if (problemsContainer) {
        problemsContainer.addEventListener('click', async function(event) {
            const target = event.target;
            if (target.classList.contains('delete-btn')) {
                const problemIdToDelete = target.dataset.problemId;
                if (confirm(`Are you sure you want to delete this problem?`)) {
                    const success = await deleteProblemOnBackend(problemIdToDelete);
                    if (success) { alert('Problem deleted successfully from server!'); } else { alert('Failed to delete problem. Check console for errors.'); }
                }
            } else if (target.classList.contains('solved-toggle')) {
                const problemIdToToggle = target.dataset.problemId;
                const problemToUpdate = allProblems.find(problem => problem.id === problemIdToToggle);
                if (problemToUpdate) {
                    problemToUpdate.solved = target.checked;
                    const success = await syncAllProblemsToBackend(allProblems);
                    if (success) { console.log("Solved status updated and synced to backend."); } else { console.error("Failed to sync solved status to backend."); }
                }
            } else if (target.classList.contains('flag-btn')) {
                const problemIdToFlag = target.dataset.problemId;
                const flagType = target.dataset.flagType;
                const problemToUpdate = allProblems.find(problem => problem.id === problemIdToFlag);
                if (problemToUpdate) {
                    problemToUpdate[flagType] = !problemToUpdate[flagType];
                    const success = await syncAllProblemsToBackend(allProblems);
                    if (success) { console.log("Important flag updated and synced to backend."); } else { console.error("Failed to sync important flag to backend."); }
                }
            } else if (target.classList.contains('toggle-solution-btn')) {
                const problemId = target.dataset.problemId;
                const solutionContainer = document.getElementById(`solution-container-${problemId}`);
                if (solutionContainer) {
                    solutionContainer.classList.toggle('hidden');
                    if (solutionContainer.classList.contains('hidden')) { target.textContent = 'View/Edit Solution'; } else { target.textContent = 'Hide Solution'; }
                }
            } else if (target.classList.contains('save-solution-btn')) {
                const problemId = target.dataset.problemId;
                const solutionTextarea = document.querySelector(`#solution-container-${problemId} .solution-textarea`);
                const problemToUpdate = allProblems.find(problem => problem.id === problemId);
                if (problemToUpdate && solutionTextarea) {
                    problemToUpdate.solutionCode = solutionTextarea.value;
                    const success = await syncAllProblemsToBackend(allProblems);
                    if (success) { alert('Solution saved successfully to server!'); } else { alert('Failed to save solution to server. Check console for errors.'); }
                }
            }
        });
    } else { console.error("problemsContainer not found!"); }

    const addNoteForm = document.querySelector('#add-note-form form');
    if (addNoteForm) {
        addNoteForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const noteTitle = document.getElementById('note-title').value;
            const noteTopic = document.getElementById('note-topic').value;
            const noteLink = document.getElementById('note-link').value;
            const noteRemarks = document.getElementById('note-remarks').value;
            const newNote = { title: noteTitle, topic: noteTopic, link: noteLink, remarks: noteRemarks, addedDate: new Date().toISOString() };
            const success = await addOrSyncNotesToBackend(newNote);
            if (success) { addNoteForm.reset(); alert('Note added successfully to server!'); } else { alert('Failed to add note. Check console for errors.'); }
        });
    } else { console.error("addNoteForm not found!"); }

    const notesContainer = document.getElementById('notes-container');
    if (notesContainer) {
        notesContainer.addEventListener('click', async function(event) {
            const target = event.target;
            if (target.classList.contains('delete-note-btn')) {
                const noteIdToDelete = target.dataset.noteId;
                if (confirm(`Are you sure you want to delete this note?`)) {
                    const success = await deleteNoteOnBackend(noteIdToDelete);
                    if (success) { alert('Note deleted successfully from server!'); } else { alert('Failed to delete note. Check console for errors.'); }
                }
            }
        });
    } else { console.error("notesContainer not found!"); }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = searchInput.value.toLowerCase();
            const filteredProblems = allProblems.filter(problem => {
                const nameMatch = problem.name.toLowerCase().includes(searchTerm);
                const topicMatch = problem.topic.toLowerCase().includes(searchTerm);
                const notesMatch = problem.notes ? problem.notes.toLowerCase().includes(searchTerm) : false;
                const timeComplexityMatch = problem.timeComplexity ? problem.timeComplexity.toLowerCase().includes(searchTerm) : false;
                const spaceComplexityMatch = problem.spaceComplexity ? problem.spaceComplexity.toLowerCase().includes(searchTerm) : false;
                return nameMatch || topicMatch || notesMatch || timeComplexityMatch || spaceComplexityMatch;
            });
            displayProblems(filteredProblems);
        });
    } else { console.error("searchInput not found!"); }

    // Add click event listeners to navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault(); const pageId = link.dataset.page; showPage(pageId);
        });
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { clearAuthFromLocalStorage(); });
    } else { console.error("Logout button NOT FOUND during DOMContentLoaded event listener setup."); }

    const userRegisterForm = document.getElementById('user-register-form');
    if (userRegisterForm) {
        userRegisterForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const success = await registerUser(username, password);
            if (success) {
                userRegisterForm.reset();
                showPage('login-section');
            }
        });
    } else { console.error("userRegisterForm not found!"); }

    const userLoginForm = document.getElementById('user-login-form');
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const success = await loginUser(username, password);
            if (success) {
                userLoginForm.reset();
            }
        });
    } else { console.error("userLoginForm not found!"); }
}); // End of DOMContentLoaded