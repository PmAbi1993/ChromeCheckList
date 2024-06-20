document.addEventListener('DOMContentLoaded', init);

const excludedReviewItems = []; // Array to store excluded item IDs
let chores = []; // Array to store the fetched chores

function init() {
    fetchChores()
        .then(data => {
            chores = data;
            createList(chores, 'todo-list', false);
            createList(chores, 'completed-list', true);

            // Hide "Not applicable" section initially
            const notApplicableSection = document.querySelector('.section.not-applicable');
            if (notApplicableSection) {
                notApplicableSection.style.display = 'none';
            }
        })
        .catch(error => console.error('Error fetching JSON:', error));

    document.getElementById('add-item-button').addEventListener('click', addItem);
    document.getElementById('generate-checklist').addEventListener('click', generateChecklist);
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
                        <input type="checkbox" class="custom-control-input" id="switch${item.index}">
                        <label class="custom-control-label" for="switch${item.index}"></label>
                    </div>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${item.index}">x</button>
                </div>
            `;
            list.appendChild(listItem); // Add the list item to the respective list

            // Add event listener for the delete button
            listItem.querySelector('.delete-btn').addEventListener('click', () => toggleExcludeItem(item.index));

            // Add event listener for the switch
            const switchInput = listItem.querySelector('.custom-control-input');
            switchInput.addEventListener('change', () => updateStatus(item.index, switchInput.checked));
        }
    });
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

    // Update the display of the "Not applicable" section
    const notApplicableSection = document.querySelector('.section.not-applicable');
    if (notApplicableSection) {
        notApplicableSection.style.display = excludedReviewItems.length > 0 ? 'block' : 'none';
    }
}

function addItem() {
    const newItemInput = document.getElementById('new-item-input');
    const newItemTitle = newItemInput.value.trim();
    if (newItemTitle) {
        const newItem = {
            index: chores.length ? chores[chores.length - 1].index + 1 : 1,
            title: newItemTitle,
            status: 'Pending'
        };
        chores.push(newItem);
        newItemInput.value = '';
        createList(chores, 'todo-list', false);
    }
}

function updateStatus(index, isChecked) {
    const item = chores.find(item => item.index === index);
    if (item) {
        item.status = isChecked ? 'Yes' : 'No';
    }
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