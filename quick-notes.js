// Quick Notes JavaScript
const qs = (s) => document.querySelector(s);

// Toast function
function toast(message) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--accent, #007bff);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 10001;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Note management functions
async function getNotes() {
  const { notes = [] } = await chrome.storage.local.get({ notes: [] });
  return notes;
}

async function saveNotes(notes) {
  await chrome.storage.local.set({ notes });
}

async function addNote(note) {
  const notes = await getNotes();
  const newNote = {
    id: Date.now().toString(),
    title: note.title || "Untitled Note",
    content: note.content || "",
    color: note.color || "default",
    created: Date.now(),
    modified: Date.now(),
    tags: note.tags || []
  };
  notes.unshift(newNote);
  await saveNotes(notes);
  return newNote;
}

async function updateNote(id, updates) {
  const notes = await getNotes();
  const index = notes.findIndex(note => note.id === id);
  if (index !== -1) {
    notes[index] = { ...notes[index], ...updates, modified: Date.now() };
    await saveNotes(notes);
    return notes[index];
  }
  return null;
}

async function deleteNote(id) {
  const notes = await getNotes();
  const filteredNotes = notes.filter(note => note.id !== id);
  await saveNotes(filteredNotes);
}

// UI functions
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

async function renderNotes(notes = null, searchTerm = '') {
  const notesToRender = notes || await getNotes();
  const grid = qs("#notesGrid");
  const emptyState = qs("#emptyState");
  
  if (notesToRender.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "block";
  } else {
    grid.style.display = "grid";
    emptyState.style.display = "none";
    grid.innerHTML = "";
    notesToRender.forEach(note => {
      grid.appendChild(createNoteElement(note, searchTerm));
    });
  }
  
  qs("#totalNotes").textContent = notesToRender.length;
  qs("#filteredNotes").textContent = notesToRender.length;
}

// Modal functions
function showModal(title, content = "") {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">Title</label>
        <input type="text" id="noteTitle" class="form-input" placeholder="Note title...">
      </div>
      <div class="form-group">
        <label class="form-label">Content</label>
        <textarea id="noteContent" class="form-textarea" placeholder="Note content..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="note-colors">
          <div class="color-btn default active" style="background: var(--card);" data-color="default"></div>
          <div class="color-btn yellow" style="background: #fef3c7;" data-color="yellow"></div>
          <div class="color-btn blue" style="background: #dbeafe;" data-color="blue"></div>
          <div class="color-btn green" style="background: #d1fae5;" data-color="green"></div>
          <div class="color-btn pink" style="background: #fce7f3;" data-color="pink"></div>
          <div class="color-btn purple" style="background: #e9d5ff;" data-color="purple"></div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNote()">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Set content if editing
  if (content) {
    qs("#noteTitle").value = content.title || "";
    qs("#noteContent").value = content.content || "";
    // Set active color
    document.querySelectorAll(".color-btn").forEach(btn => {
      btn.classList.remove("active");
      if (btn.dataset.color === content.color) {
        btn.classList.add("active");
      }
    });
  }
  
  // Color selection
  document.querySelectorAll(".color-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  
  // Focus on title
  qs("#noteTitle").focus();
}

function closeModal() {
  const modal = document.querySelector(".modal");
  if (modal) modal.remove();
}

// Global functions for onclick handlers
window.editNote = async function(id) {
  const notes = await getNotes();
  const note = notes.find(n => n.id === id);
  if (note) {
    window.currentEditingId = id;
    showModal("Edit Note", note);
  }
};

window.copyNote = async function(id) {
  const notes = await getNotes();
  const note = notes.find(n => n.id === id);
  if (note) {
    try {
      await navigator.clipboard.writeText(note.content);
      toast("Note copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy note:", error);
      toast("Failed to copy note");
    }
  }
};

window.deleteNote = async function(id) {
  if (confirm("Are you sure you want to delete this note?")) {
    await deleteNote(id);
    await renderNotes();
    toast("Note deleted");
  }
};

window.saveNote = async function() {
  const title = qs("#noteTitle").value.trim();
  const content = qs("#noteContent").value.trim();
  const colorBtn = document.querySelector(".color-btn.active");
  const color = colorBtn ? colorBtn.dataset.color : "default";
  
  if (!title && !content) {
    toast("Please enter a title or content");
    return;
  }
  
  try {
    if (window.currentEditingId) {
      await updateNote(window.currentEditingId, { title, content, color });
      toast("Note updated");
    } else {
      await addNote({ title, content, color });
      toast("Note created");
    }
    
    closeModal();
    await renderNotes();
    window.currentEditingId = null;
  } catch (error) {
    console.error("Failed to save note:", error);
    toast("Failed to save note");
  }
};

// Enhanced search functionality
function highlightSearchTerm(text, searchTerm) {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background: #fef08a; color: #92400e; padding: 1px 2px; border-radius: 2px;">$1</mark>');
}

function getSearchSuggestions(query, notes) {
  if (!query || query.length < 2) return [];
  
  const suggestions = new Set();
  
  notes.forEach(note => {
    const text = `${note.title} ${note.content}`.toLowerCase();
    const words = text.split(/\s+/).filter(word => 
      word.length > 2 && word.includes(query.toLowerCase())
    );
    
    words.forEach(word => suggestions.add(word));
  });
  
  return Array.from(suggestions).slice(0, 5);
}

async function searchNotes(query) {
  const notes = await getNotes();
  if (!query.trim()) {
    await renderNotes(notes);
    return;
  }
  
  const filtered = notes.filter(note => {
    const searchFields = [
      note.title,
      note.content,
      note.tags.join(' '),
      new Date(note.created).toLocaleDateString(),
      new Date(note.modified).toLocaleDateString()
    ];
    
    return searchFields.some(field => 
      field && field.toString().toLowerCase().includes(query.toLowerCase())
    );
  });
  
  await renderNotes(filtered, query);
}

function createNoteElement(note, searchTerm = '') {
  const div = document.createElement("div");
  div.className = `note-item color-${note.color}`;
  
  const highlightedTitle = highlightSearchTerm(note.title, searchTerm);
  const highlightedContent = highlightSearchTerm(note.content, searchTerm);
  
  div.innerHTML = `
    <div class="note-header">
      <div class="note-title">${highlightedTitle}</div>
      <div class="note-meta">${formatDate(note.modified)}</div>
    </div>
    <div class="note-content">${highlightedContent}</div>
    <div class="note-actions">
      <button class="action-btn" onclick="editNote('${note.id}')">Edit</button>
      <button class="action-btn" onclick="copyNote('${note.id}')">Copy</button>
      <button class="action-btn" onclick="deleteNote('${note.id}')">Delete</button>
    </div>
  `;
  return div;
}

// Export/Import functionality
async function exportNotes() {
  const notes = await getNotes();
  const dataStr = JSON.stringify(notes, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `copy-master-notes-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast("Notes exported successfully");
}

async function importNotes() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedNotes = JSON.parse(text);
      
      if (Array.isArray(importedNotes)) {
        const existingNotes = await getNotes();
        const mergedNotes = [...importedNotes, ...existingNotes];
        await saveNotes(mergedNotes);
        await renderNotes();
        toast("Notes imported successfully");
      } else {
        toast("Invalid notes file format");
      }
    } catch (error) {
      console.error("Failed to import notes:", error);
      toast("Failed to import notes");
    }
  };
  
  input.click();
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {
  await renderNotes();
  
  // Add note button
  qs("#addNoteBtn").addEventListener("click", () => {
    window.currentEditingId = null;
    showModal("Add New Note");
  });
  
  // Search
  qs("#searchInput").addEventListener("input", (e) => {
    searchNotes(e.target.value);
  });
  
  // Export/Import
  qs("#exportBtn").addEventListener("click", exportNotes);
  qs("#importBtn").addEventListener("click", importNotes);
  
  // Help buttons
  qs("#helpBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  });
  
  qs("#requestFeatureBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://forms.fillout.com/t/2QMi7uSS59us" });
  });
  
  // Close modal on background click
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      closeModal();
    }
  });
  
  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });
});
