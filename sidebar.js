// sidebar.js

// --- DOM Elements ---
const bookmarksList = document.getElementById('bookmarks-list');
const tabsList = document.getElementById('tabs-list');
const spacesList = document.getElementById('spaces-list');
const pinnedList = document.getElementById('pinned-list');
const newSpaceBtn = document.querySelector('.new-space-btn');

// --- Global State (View-only) ---
let currentSpaceId = null;
let isSwitching = false;


// --- Rendering Logic ---

function render(state) {
  console.log("Rendering UI with new state:", state);
  currentSpaceId = state.currentSpaceId;
  isSwitching = state.isSwitching;
  
  const currentSpace = state.spaces.find(s => s.id === currentSpaceId);

  renderSpacesFooter(state.spaces, currentSpaceId);
  if (currentSpace) {
    renderBookmarks(currentSpace.bookmarks);
    renderOpenTabs(currentSpace.openTabs);
  } else {
    bookmarksList.innerHTML = '<li>Select a space to see bookmarks.</li>';
    tabsList.innerHTML = '<li>Select a space to see open tabs.</li>';
  }
}

function renderBookmarks(bookmarks) {
  bookmarksList.innerHTML = '';
  if (!bookmarks || bookmarks.length === 0) {
    bookmarksList.innerHTML = '<li>No bookmarks in this space.</li>';
    return;
  }

  bookmarks.forEach(bookmark => {
    const li = document.createElement('li');
    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(bookmark.url).hostname)}&sz=16`;
    favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; };
    li.appendChild(favicon);

    const textNode = document.createElement('span');
    textNode.className = 'item-text';
    textNode.textContent = bookmark.title || bookmark.url;
    li.appendChild(textNode);

    li.title = bookmark.url;
    li.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'createTab', data: { url: bookmark.url } });
    });

    const deleteBtn = document.createElement('span');
    deleteBtn.innerHTML = '&#x2715;';
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete bookmark';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'deleteBookmark', data: { bookmarkId: bookmark.id } });
    });
    li.appendChild(deleteBtn);
    bookmarksList.appendChild(li);
  });
}

function renderOpenTabs(openTabs) {
  tabsList.innerHTML = '';
  if (!openTabs || openTabs.length === 0) {
    tabsList.innerHTML = '<li>No open tabs in this space.</li>';
    return;
  }

  openTabs.forEach(tab => {
    const li = document.createElement('li');
    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(tab.url).hostname)}&sz=16`;
    favicon.onerror = () => { favicon.src = 'icons/default_favicon.png'; };
    li.appendChild(favicon);

    const textNode = document.createElement('span');
    textNode.className = 'item-text';
    textNode.textContent = tab.title || tab.url;
    li.appendChild(textNode);

    li.title = tab.url;
    li.dataset.tabId = tab.id;
    li.addEventListener('click', () => {
      chrome.tabs.update(tab.id, { active: true });
    });

    const deleteBtn = document.createElement('span');
    deleteBtn.innerHTML = '&#x2715;';
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Close tab';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'closeTab', data: { tabId: tab.id } });
    });
    li.appendChild(deleteBtn);
    tabsList.appendChild(li);
  });
}

function renderSpacesFooter(spaces, activeSpaceId) {
  spacesList.innerHTML = '';
  spaces.forEach(space => {
    if (space.name === 'pin') return;
    
    const li = document.createElement('li');
    li.textContent = isEmoji(space.icon) ? space.icon : space.name.substring(0, 2).toUpperCase();
    li.title = space.name;
    li.dataset.spaceId = space.id;
    if (space.id === activeSpaceId) {
      li.classList.add('active-space');
    }
    li.addEventListener('click', () => {
      if (isSwitching || space.id === activeSpaceId) return;
      spacesList.childNodes.forEach(node => node.classList.remove('active-space'));
      li.classList.add('active-space'); // Optimistic update
      chrome.runtime.sendMessage({ action: 'switchSpace', data: { spaceId: space.id } });
    });
    spacesList.appendChild(li);
  });
}

function isEmoji(char) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/u;
    return emojiRegex.test(char);
}


// --- Event Listeners ---

newSpaceBtn.addEventListener('click', () => {
  const newSpaceName = prompt('Enter name for the new space:');
  if (newSpaceName && newSpaceName.trim() !== '') {
    chrome.runtime.sendMessage({ action: 'createSpace', data: { newSpaceName: newSpaceName.trim() } });
  }
});

// Listen for state updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'stateUpdated') {
    render(request.data);
  }
});


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const initialState = await chrome.runtime.sendMessage({ action: 'getState' });
    if (initialState) {
      render(initialState);
    } else {
        console.error("Could not get initial state from background script.")
    }
  } catch(error) {
      console.error("Error getting initial state: ", error);
      document.body.innerHTML = "Error loading Archrome. Try reloading the extension.";
  }
});
