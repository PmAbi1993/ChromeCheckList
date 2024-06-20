document.addEventListener('DOMContentLoaded', function() {
    fetch(chrome.runtime.getURL('chores.json')) // Fetch the JSON file from the extension
        .then(response => response.json()) // Parse the JSON data
        .then(data => {
            const todoList = document.getElementById('todo-list');
            data.forEach(item => {
                const listItem = document.createElement('li');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                listItem.innerHTML = `
                    <span>${item.title}</span>
                    <div class="d-flex align-items-center">
                        <div class="custom-control custom-switch mr-2">
                            <input type="checkbox" class="custom-control-input" id="switch${item.index}">
                            <label class="custom-control-label" for="switch${item.index}"></label>
                        </div>
                        <button class="btn btn-danger btn-sm delete-btn">x</button>
                    </div>
                `;
                todoList.appendChild(listItem); // Add the list item to the to-do list
            });
        })
        .catch(error => console.error('Error fetching JSON:', error)); // Handle errors
});