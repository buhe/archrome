// sidebar.js

const bookmarksList = document.getElementById('bookmarks-list');
const tabsList = document.getElementById('tabs-list');
const spacesList = document.getElementById('spaces-list');
const pinnedList = document.getElementById('pinned-list');

// --- Helper Functions ---
function isEmoji(char) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/u;
  return emojiRegex.test(char);
}

// --- Rendering Logic ---

function render(state) {
    if (!state || !state.spaces) {
        console.warn("Render called with invalid state.", state);
        return;
    }
    console.log("Rendering UI with state:", state);
    const currentSpace = state.spaces.find(s => s.id === state.currentSpaceId);
    
    renderSpacesFooter(state.spaces, state.currentSpaceId);
    renderPinnedBookmarks(state.spaces); // Pinned bookmarks are also derived from spaces list
    
    if (currentSpace) {
        renderBookmarks(currentSpace.bookmarks);
        renderOpenTabs(currentSpace.openTabs);
    } else {
        bookmarksList.innerHTML = '<li>No space selected.</li>';
        tabsList.innerHTML = '<li>No space selected.</li>';
    }
}

function renderBookmarks(bookmarks) {
  bookmarksList.innerHTML = '';
  if (bookmarks && bookmarks.length > 0) {
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
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        chrome.tabs.create({ url: bookmark.url });
      });

      const deleteBtn = document.createElement('span');
      deleteBtn.innerHTML = '&#x2715;';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Delete bookmark';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'deleteBookmark', bookmarkId: bookmark.id });
      });
      li.appendChild(deleteBtn);
      bookmarksList.appendChild(li);
    });
  } else {
    bookmarksList.innerHTML = '<li>No bookmarks in this space.</li>';
  }
}

function renderOpenTabs(openTabs) {
  tabsList.innerHTML = '';
  if (openTabs && openTabs.length > 0) {
    openTabs.forEach(tab => {
      const li = document.createElement('li');
      li.draggable = true;
      li.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify(tab));
        event.dataTransfer.effectAllowed = 'move';
      });

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
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        chrome.tabs.update(tab.id, { active: true });
      });

      const deleteBtn = document.createElement('span');
      deleteBtn.innerHTML = '&#x2715;';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Close tab';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await chrome.tabs.remove(tab.id);
        } catch (error) {
          console.error('Error closing tab via X button:', error);
        }
      });
      li.appendChild(deleteBtn);
      tabsList.appendChild(li);
    });
  } else {
    tabsList.innerHTML = '<li>No open tabs in this space.</li>';
  }
}

function renderSpacesFooter(spaces, currentSpaceId) {
  spacesList.innerHTML = '';
  spaces.forEach(space => {
    if (space.name === 'pin') return;

    const li = document.createElement('li');
    li.textContent = isEmoji(space.icon) ? space.icon : (space.name ? space.name.substring(0, 2).toUpperCase() : 'SP');
    li.title = space.name;
    li.dataset.spaceId = space.id;
    if (space.id === currentSpaceId) {
      li.classList.add('active-space');
    }
    li.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'switchSpace', spaceId: space.id });
    });
    spacesList.appendChild(li);
  });
}

async function renderPinnedBookmarks(spaces) {
  pinnedList.innerHTML = '';
  const pinFolder = spaces.find(node => node.name.toLowerCase() === 'pin');

  if (pinFolder && pinFolder.bookmarks.length > 0) {
    pinFolder.bookmarks.forEach(bookmark => {
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
      li.addEventListener('click', () => chrome.tabs.create({ url: bookmark.url }));
      pinnedList.appendChild(li);
    });
  } else {
    pinnedList.innerHTML = '<li>No pinned bookmarks found in "pin" folder.</li>';
  }
}


// --- Event Handlers ---

// Handle drop events to add a tab as a bookmark
bookmarksList.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
});

bookmarksList.addEventListener('drop', (event) => {
  event.preventDefault();
  const tabData = JSON.parse(event.dataTransfer.getData('text/plain'));
  if (tabData.url && tabData.title) {
    chrome.runtime.sendMessage({ action: 'addBookmark', tab: tabData });
  }
});

// Listen for state updates from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'stateUpdated') {
    console.log('Received state update from background.');
    render(request.state);
  }
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  // Request initial state from the background script
  chrome.runtime.sendMessage({ action: 'getState' }, (initialState) => {
    if (chrome.runtime.lastError) {
        console.error("Error getting initial state:", chrome.runtime.lastError.message);
        bookmarksList.innerHTML = `<li>Error: ${chrome.runtime.lastError.message}. Try reloading the extension.</li>`;
        return;
    }
    if (initialState) {
      render(initialState);
    } else {
      // This can happen if the background script hasn't loaded its state yet.
      // It will broadcast a state update shortly anyway.
      console.log("Initial state not immediately available, waiting for broadcast.");
      bookmarksList.innerHTML = `<li>Loading spaces...</li>`;
    }
  });

  // Add event listener for the "Add Space" button
  const newSpaceBtn = document.querySelector('.new-space-btn');
  if (newSpaceBtn) {
    newSpaceBtn.addEventListener('click', () => {
      const newSpaceName = prompt('Enter name for the new space:');
      if (newSpaceName && newSpaceName.trim() !== '') {
        chrome.runtime.sendMessage({ action: 'createSpace', name: newSpaceName.trim() });
      }
    });
  }
});