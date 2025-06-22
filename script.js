document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let state = {
        topics: [],
        recycleBin: [],
    };

    const COLUMNS = {
        'col1': 'Today & Not Lazy',
        'col2': 'Today & Lazy',
        'col3': 'Tomorrow & Not Lazy',
        'col4': 'Tomorrow & Lazy',
        'col5': 'Specific Date'
    };

    // --- DOM ELEMENT REFERENCES ---
    const topicList = document.getElementById('topic-list');
    const newTopicInput = document.getElementById('new-topic-input');
    const addTopicBtn = document.getElementById('add-topic-btn');
    const recycleBinList = document.getElementById('recycle-bin-list');
    const priorityMatrix = document.getElementById('priority-matrix');

    // --- LOCAL STORAGE ---
    function saveState() {
        localStorage.setItem('prioritizeTaskState', JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem('prioritizeTaskState');
        if (savedState) {
            state = JSON.parse(savedState);
        }
    }

    // --- RENDER FUNCTIONS ---
    function render() {
        renderTopicList();
        renderPriorityMatrix();
        renderRecycleBin();
        saveState();
    }

    function renderTopicList() {
        topicList.innerHTML = '';
        state.topics.forEach((topic, topicIndex) => {
            const topicSlNo = topicIndex + 1;
            const topicItem = document.createElement('li');
            topicItem.className = 'topic-item draggable';
            topicItem.setAttribute('draggable', true);
            topicItem.dataset.id = topic.id;

            topicItem.innerHTML = `
                <div class="item-content">
                    <span class="sl-no" title="Click to change S/L No.">${topicSlNo}</span>
                    <span class="item-text" contenteditable="true" title="Click to edit">${topic.text}</span>
                </div>
                <div class="item-actions">
                    <button class="add-subtopic-btn" title="Add Subtopic">&#43;</button>
                    <button class="delete-btn" title="Delete Topic">&#128465;</button>
                </div>
            `;
            topicList.appendChild(topicItem);

            // Add Subtopic Form
            const addSubtopicForm = document.createElement('div');
            addSubtopicForm.className = 'add-subtopic-form';
            addSubtopicForm.dataset.topicId = topic.id;
            addSubtopicForm.innerHTML = `
                <input type="text" class="new-subtopic-input" placeholder="New subtopic...">
                <select class="column-select">
                    <option value="col1">Today & Not Lazy</option>
                    <option value="col2">Today & Lazy</option>
                    <option value="col3">Tomorrow & Not Lazy</option>
                    <option value="col4">Tomorrow & Lazy</option>
                    <option value="col5">Specific Date</option>
                </select>
                <button class="save-subtopic-btn">Save</button>
            `;
            topicItem.after(addSubtopicForm); // Insert form right after the topic item

            // Render Subtopics
            const subtopicList = document.createElement('ul');
            addSubtopicForm.after(subtopicList); // Place subtopic list after the form
            if (topic.subtopics) {
                topic.subtopics.forEach((subtopic, subtopicIndex) => {
                    const subtopicSlNo = `${topicSlNo}.${subtopicIndex + 1}`;
                    const subtopicItem = document.createElement('li');
                    subtopicItem.className = 'subtopic-item draggable';
                    subtopicItem.setAttribute('draggable', true);
                    subtopicItem.dataset.id = subtopic.id;
                    subtopicItem.dataset.parentId = topic.id;
                    subtopicItem.innerHTML = `
                        <div class="item-content">
                            <span class="sl-no">${subtopicSlNo}</span>
                            <span class="item-text" contenteditable="true" title="Click to edit">${subtopic.text}</span>
                        </div>
                        <div class="item-actions">
                             <button class="delete-btn" title="Delete Subtopic">&#128465;</button>
                        </div>
                    `;
                    subtopicList.appendChild(subtopicItem);
                });
            }
        });
    }

    function renderPriorityMatrix() {
        // Clear all columns first
        Object.keys(COLUMNS).forEach(colId => {
            const col = document.getElementById(colId);
            if(col) col.querySelector('.subtopic-drop-list').innerHTML = '';
        });

        // Populate columns
        state.topics.forEach((topic, topicIndex) => {
            if (!topic.subtopics) return;
            topic.subtopics.forEach(subtopic => {
                const columnEl = document.getElementById(subtopic.column)?.querySelector('.subtopic-drop-list');
                if (columnEl) {
                    const matrixItem = document.createElement('li');
                    matrixItem.className = 'matrix-subtopic';
                    matrixItem.dataset.id = subtopic.id;
                    matrixItem.innerHTML = `
                        ${subtopic.text}
                        <span class="topic-ref">From: ${topic.text}</span>
                    `;
                    columnEl.appendChild(matrixItem);
                }
            });
        });
    }

    function renderRecycleBin() {
        recycleBinList.innerHTML = '';
        state.recycleBin.forEach(item => {
            const li = document.createElement('li');
            li.className = 'deleted-item';
            li.dataset.id = item.id;
            li.innerHTML = `
                <span class="item-text">${item.text} (${item.type})</span>
                <div class="item-actions">
                    <button class="restore-btn" title="Restore">&#128472;</button>
                </div>
            `;
            recycleBinList.appendChild(li);
        });
    }

    // --- CORE LOGIC ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function addTopic() {
        const text = newTopicInput.value.trim();
        if (text) {
            state.topics.push({
                id: generateId(),
                text: text,
                subtopics: []
            });
            newTopicInput.value = '';
            render();
        }
    }

    function addSubtopic(topicId, text, column) {
        const topic = state.topics.find(t => t.id === topicId);
        if (topic && text) {
            if (!topic.subtopics) topic.subtopics = [];
            topic.subtopics.push({
                id: generateId(),
                text: text,
                column: column
            });
            render();
        }
    }

    function deleteItem(element) {
        const isSubtopic = element.classList.contains('subtopic-item');
        const id = element.dataset.id;
        
        if (isSubtopic) {
            const parentId = element.dataset.parentId;
            if (confirm('Are you sure you want to delete this subtopic?')) {
                const topic = state.topics.find(t => t.id === parentId);
                const subtopicIndex = topic.subtopics.findIndex(st => st.id === id);
                const [deletedSubtopic] = topic.subtopics.splice(subtopicIndex, 1);
                deletedSubtopic.type = 'subtopic';
                deletedSubtopic.parentId = parentId; // Store parent for restoration
                state.recycleBin.push(deletedSubtopic);
            }
        } else { // It's a topic
            if (confirm('Are you sure you want to delete this topic and all its subtopics?')) {
                const topicIndex = state.topics.findIndex(t => t.id === id);
                const [deletedTopic] = state.topics.splice(topicIndex, 1);
                deletedTopic.type = 'topic';
                state.recycleBin.push(deletedTopic);
            }
        }
        render();
    }

    function restoreItem(id) {
        const itemIndex = state.recycleBin.findIndex(i => i.id === id);
        const [itemToRestore] = state.recycleBin.splice(itemIndex, 1);

        if (itemToRestore.type === 'topic') {
            state.topics.push(itemToRestore);
        } else if (itemToRestore.type === 'subtopic') {
            const topic = state.topics.find(t => t.id === itemToRestore.parentId);
            if (topic) {
                if (!topic.subtopics) topic.subtopics = [];
                topic.subtopics.push(itemToRestore);
            } else { // Parent topic was also deleted, so restore it too
                alert("Parent topic not found. This can happen if the parent was deleted separately. Restoring item as a new topic.");
                state.topics.push({ id: itemToRestore.id, text: itemToRestore.text, subtopics: [] });
            }
        }
        render();
    }
    
    function updateText(element) {
        const id = element.closest('[data-id]').dataset.id;
        const newText = element.textContent.trim();
        const isSubtopic = element.closest('.subtopic-item');

        if (isSubtopic) {
            const parentId = element.closest('[data-parent-id]').dataset.parentId;
            const topic = state.topics.find(t => t.id === parentId);
            const subtopic = topic.subtopics.find(st => st.id === id);
            subtopic.text = newText;
        } else {
            const topic = state.topics.find(t => t.id === id);
            topic.text = newText;
        }
        render(); // Re-render to update matrix if needed
    }

    function changeTopicSlNo(topicId) {
        const topicIndex = state.topics.findIndex(t => t.id === topicId);
        const currentSlNo = topicIndex + 1;
        const newSlNo = parseInt(prompt(`Enter new serial number for this topic (current is ${currentSlNo}):`, currentSlNo));

        if (!isNaN(newSlNo) && newSlNo > 0 && newSlNo <= state.topics.length) {
            const [movedTopic] = state.topics.splice(topicIndex, 1);
            state.topics.splice(newSlNo - 1, 0, movedTopic);
            render();
        } else {
            alert('Invalid serial number.');
        }
    }

    // --- DRAG AND DROP ---
    let draggedElement = null;

    topicList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('draggable')) {
            draggedElement = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    topicList.addEventListener('dragend', (e) => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            draggedElement = null;
            // Clean up any lingering drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }
    });

    topicList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.draggable');
        if (target && draggedElement && target !== draggedElement) {
            // Check if we are dragging items of the same type
            const isDraggedSub = draggedElement.classList.contains('subtopic-item');
            const isTargetSub = target.classList.contains('subtopic-item');
            if (isDraggedSub === isTargetSub) {
                 // Logic to show where it will be dropped
                document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                target.classList.add('drag-over');
            }
        }
    });

    topicList.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetElement = e.target.closest('.draggable');
        if (!targetElement || !draggedElement) return;

        targetElement.classList.remove('drag-over');
        const draggedId = draggedElement.dataset.id;
        const targetId = targetElement.dataset.id;

        const isSubtopic = draggedElement.classList.contains('subtopic-item');

        if (isSubtopic) {
            const parentId = draggedElement.dataset.parentId;
            const topic = state.topics.find(t => t.id === parentId);
            if (topic && targetElement.dataset.parentId === parentId) { // Ensure dropping in same subtopic list
                const fromIndex = topic.subtopics.findIndex(st => st.id === draggedId);
                const toIndex = topic.subtopics.findIndex(st => st.id === targetId);
                const [item] = topic.subtopics.splice(fromIndex, 1);
                topic.subtopics.splice(toIndex, 0, item);
            }
        } else { // It's a topic
            const fromIndex = state.topics.findIndex(t => t.id === draggedId);
            const toIndex = state.topics.findIndex(t => t.id === targetId);
            const [item] = state.topics.splice(fromIndex, 1);
            state.topics.splice(toIndex, 0, item);
        }
        render();
    });

    // --- EVENT LISTENERS ---
    addTopicBtn.addEventListener('click', addTopic);
    newTopicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTopic();
    });

    topicList.addEventListener('click', (e) => {
        // Delete button
        if (e.target.classList.contains('delete-btn')) {
            deleteItem(e.target.closest('.topic-item, .subtopic-item'));
        }
        // Add subtopic button (to show the form)
        if (e.target.classList.contains('add-subtopic-btn')) {
            const form = e.target.closest('.topic-item').nextElementSibling;
            form.classList.toggle('show');
        }
        // Save subtopic button
        if (e.target.classList.contains('save-subtopic-btn')) {
            const form = e.target.closest('.add-subtopic-form');
            const topicId = form.dataset.topicId;
            const textInput = form.querySelector('.new-subtopic-input');
            const columnSelect = form.querySelector('.column-select');
            addSubtopic(topicId, textInput.value.trim(), columnSelect.value);
            textInput.value = '';
            form.classList.remove('show');
        }
        // Change S/L No
        if (e.target.classList.contains('sl-no') && e.target.closest('.topic-item')) {
            changeTopicSlNo(e.target.closest('.topic-item').dataset.id);
        }
    });

    topicList.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('item-text')) {
            updateText(e.target);
        }
    });
    
    topicList.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('item-text')) {
            e.preventDefault();
            e.target.blur(); // Triggers the focusout event to save
        }
    });

    recycleBinList.addEventListener('click', (e) => {
        if (e.target.classList.contains('restore-btn')) {
            restoreItem(e.target.closest('.deleted-item').dataset.id);
        }
    });

    // --- INITIALIZATION ---
    loadState();
    render();
});