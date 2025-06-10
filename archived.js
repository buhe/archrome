document.addEventListener('DOMContentLoaded', () => {
  const archivedTabsList = document.getElementById('archived-tabs-list');

  // Function to load and display archived tabs
  function loadArchivedTabs() {
    chrome.storage.local.get(['archivedTabs'], (result) => {
      let tabs = result.archivedTabs || [];
      // Sort tabs by archivedAt in descending order (newest first)
      tabs.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));

      archivedTabsList.innerHTML = ''; // Clear existing list

      if (tabs.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.textContent = 'No archived tabs yet.';
        archivedTabsList.appendChild(emptyMessage);
        return;
      }

      tabs.forEach(tab => {
        const listItem = document.createElement('li');
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'title';
        titleSpan.textContent = tab.title || 'No Title';
        listItem.appendChild(titleSpan);

        const urlSpan = document.createElement('span');
        urlSpan.className = 'url';
        urlSpan.textContent = tab.url;
        listItem.appendChild(urlSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const restoreButton = document.createElement('button');
        restoreButton.textContent = 'Restore';
        restoreButton.addEventListener('click', () => {
          // Placeholder for restore functionality
          chrome.tabs.create({ url: tab.url });
          // Optionally, remove from archived list after restoring
          removeTabFromArchive(tab.id || tab.url); // Assuming tab has a unique ID or use URL
        });
        actionsDiv.appendChild(restoreButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
          // Placeholder for delete functionality
          removeTabFromArchive(tab.id || tab.url);
        });
        actionsDiv.appendChild(deleteButton);

        listItem.appendChild(actionsDiv);
        archivedTabsList.appendChild(listItem);
      });
    });
  }

  // Function to remove a tab from archive (and update display)
  function removeTabFromArchive(tabIdentifier) {
    chrome.storage.local.get(['archivedTabs'], (result) => {
      let tabs = result.archivedTabs || [];
      tabs = tabs.filter(t => (t.id || t.url) !== tabIdentifier);
      chrome.storage.local.set({ archivedTabs: tabs }, () => {
        loadArchivedTabs(); // Refresh the list
      });
    });
  }

  // Initial load
  loadArchivedTabs();

  // Handle back button click
  const backButton = document.getElementById('back-to-sidebar');
  if (backButton) {
    backButton.addEventListener('click', () => {
      chrome.sidePanel.setOptions({
        path: 'sidebar.html'
      }).then(() => {
        console.log('Side panel path set back to sidebar.html');
      }).catch(error => {
        console.error('Error setting side panel path:', error);
      });
    });
  }
});