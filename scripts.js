document.addEventListener('DOMContentLoaded', init);

let excludedReviewItems = []; // Array to store excluded item IDs
let chores = []; // Array to store the fetched chores
let currentTabUrl = '';

function init() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        currentTabUrl = tabs[0].url;
        loadState(currentTabUrl);

        fetchChores()
            .then(data => {
                // Update chores with the data from JSON, but keep the statuses from the local storage if they exist
                chores = data.map(item => {
                    const existingItem = chores.find(chore => chore.index === item.index);
                    return existingItem ? { ...item, status: existingItem.status } : { ...item, status: 'No' };
                });
                createList(chores, 'todo-list', false);
                createList(chores, 'completed-list', true);

                // Hide "Not applicable" section initially
                const notApplicableSection = document.querySelector('.section.not-applicable');
                if (notApplicableSection) {
                    notApplicableSection.style.display = excludedReviewItems.length > 0 ? 'block' : 'none';
                }

                // Check if "Select All" should be checked initially
                updateSelectAllToggle();
                // Enable or disable the "Select All" toggle based on the "Not applicable" list
                updateSelectAllState();
            })
            .catch(error => console.error('Error fetching JSON:', error));

        document.getElementById('add-item-button').addEventListener('click', addItem);
        document.getElementById('generate-checklist').addEventListener('click', () => {
            generateChecklist();
            showNotification('Checklist copied to your clipboard.');
            // Close the extension after a short delay
            setTimeout(closeExtension, 2000);
        });
        document.getElementById('select-all-switch').addEventListener('change', toggleSelectAll);
    });
}

function fetchChores() {
    return fetch(chrome.runtime.getURL('chores.json'))
        .then(response => response.json());
}

function createList(data, listId, isExcluded) {
    const list = document.getElementById(listId);
    list.innerHTML = ''; // Clear the list before creating new items
    data.forEach(item => {
        const shouldExclude = excludedReviewItems.includes(item.index);
        if (shouldExclude === isExcluded) {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.innerHTML = `
                <span>${item.title}</span>
                <div class="d-flex align-items-center">
                    <div class="custom-control custom-switch mr-2">
                        <input type="checkbox" class="custom-control-input" id="switch${item.index}" ${item.status === 'Yes' ? 'checked' : ''}>
                        <label class="custom-control-label" for="switch${item.index}"></label>
                    </div>
                    <button class="btn btn-sm delete-btn" data-id="${item.index}">x</button>
                </div>
            `;
            list.appendChild(listItem); // Add the list item to the respective list

            // Add event listener for the delete button
            listItem.querySelector('.delete-btn').addEventListener('click', () => toggleExcludeItem(item.index));

            // Add event listener for the switch
            const switchInput = listItem.querySelector('.custom-control-input');
            switchInput.addEventListener('change', () => {
                updateStatus(item.index, switchInput.checked);
                updateSelectAllToggle(); // Check the state of all checkboxes whenever one changes
            });
        }
    });

    // Enable or disable the "Select All" toggle based on the "Not applicable" list
    updateSelectAllState();
}

function toggleExcludeItem(itemId) {
    const index = excludedReviewItems.indexOf(itemId);
    if (index === -1) {
        excludedReviewItems.push(itemId);
    } else {
        excludedReviewItems.splice(index, 1);
    }
    // Recreate the lists to reflect the changes
    createList(chores, 'todo-list', false);
    createList(chores, 'completed-list', true);

    // Save state to local storage
    saveState(currentTabUrl);

    // Update the display of the "Not applicable" section
    const notApplicableSection = document.querySelector('.section.not-applicable');
    if (notApplicableSection) {
        notApplicableSection.style.display = excludedReviewItems.length > 0 ? 'block' : 'none';
    }

    // Enable or disable the "Select All" toggle based on the "Not applicable" list
    updateSelectAllState();
}

function addItem() {
    const newItemInput = document.getElementById('new-item-input');
    const newItemTitle = newItemInput.value.trim();
    if (newItemTitle) {
        const newItem = {
            index: chores.length ? chores[chores.length - 1].index + 1 : 1,
            title: newItemTitle,
            status: 'No'
        };
        chores.push(newItem);
        newItemInput.value = '';
        createList(chores, 'todo-list', false);
        
        // Save state to local storage
        saveState(currentTabUrl);
    }
}

function updateStatus(index, isChecked) {
    const item = chores.find(item => item.index === index);
    if (item) {
        item.status = isChecked ? 'Yes' : 'No';
    }

    // Save state to local storage
    saveState(currentTabUrl);
}

function generateChecklist() {
    const prChecklist = generateMarkdownTable(chores.filter(item => !excludedReviewItems.includes(item.index) && item.status !== 'NA'));
    const notApplicableItems = chores.filter(item => excludedReviewItems.includes(item.index));
    const notApplicable = notApplicableItems.length > 0 ? generateNotApplicableMarkdownTable(notApplicableItems) : '';

    let markdown = `
-------------------
### PR Checklist
-------------------
${prChecklist}
`;

    if (notApplicable) {
        markdown += `
-------------------
### Not applicable
-------------------
${notApplicable}
`;
    }

    copyToClipboard(markdown.trim());

    // Hide "Not applicable" section if there are no excluded items
    const notApplicableSection = document.querySelector('.section.not-applicable');
    if (notApplicableSection) {
        notApplicableSection.style.display = notApplicableItems.length > 0 ? 'block' : 'none';
    }
}

function generateMarkdownTable(items) {
    let table = `| **Index** | **Review task** | **Status** |\n`;
    table += `| --- | --- | --- |\n`;
    items.forEach(item => {
        const status = item.status !== undefined ? item.status : 'No';
        table += `| ${item.index} | ${item.title} | ${status} |\n`;
    });
    return table;
}

function generateNotApplicableMarkdownTable(items) {
    let table = `| **Index** | **Review task** |\n`;
    table += `| --- | --- |\n`;
    items.forEach(item => {
        table += `| ${item.index} | ${item.title} |\n`;
    });
    return table;
}

function copyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
}

function saveState(url) {
    const state = {
        chores,
        excludedReviewItems
    };
    localStorage.setItem(`checklistState_${encodeURIComponent(url)}`, JSON.stringify(state));
}

function loadState(url) {
    const state = JSON.parse(localStorage.getItem(`checklistState_${encodeURIComponent(url)}`));
    if (state) {
        chores = state.chores;
        excludedReviewItems = state.excludedReviewItems; // Replace the array entirely
    }
}

function toggleSelectAll() {
    const selectAllSwitch = document.getElementById('select-all-switch');
    const isChecked = selectAllSwitch.checked;
    chores.forEach(item => {
        item.status = isChecked ? 'Yes' : 'No';
    });
    createList(chores, 'todo-list', false);
    saveState(currentTabUrl);
}

// New function to update the "Select All" toggle based on the state of all checkboxes
function updateSelectAllToggle() {
    const selectAllSwitch = document.getElementById('select-all-switch');
    const allSelected = chores.every(item => item.status === 'Yes');
    selectAllSwitch.checked = allSelected;
}

// New function to enable or disable the "Select All" toggle based on the "Not applicable" list
function updateSelectAllState() {
    const selectAllSwitch = document.getElementById('select-all-switch');
    selectAllSwitch.disabled = excludedReviewItems.length > 0;
}

// Function to show a notification
function showNotification(message) {
    const notificationId = 'checklist-notification';
    chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'checklist.png',
        title: 'Checklist Notification',
        message: message,
        priority: 2
    });
}

// Function to close the Chrome extension
function closeExtension() {
    window.close();
}
