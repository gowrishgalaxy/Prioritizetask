document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const newTopicInput = document.getElementById('new-topic-input');
    const addTopicBtn = document.getElementById('add-topic-btn');
    const topicList = document.getElementById('topic-list');
    const recycleBinList = document.getElementById('recycle-bin-list');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    // --- TEMPLATES ---
    const topicTemplate = document.getElementById('topic-template');
    const subtopicTemplate = document.getElementById('subtopic-template');
    const taskCardTemplate = document.getElementById('task-card-template');

    // --- STATE ---
    let elementToDelete = null;
    let draggedItem = null;

    // --- FUNCTIONS ---

    /**
     * Updates all serial numbers for topics and their subtopics.
     */
    const updateSerialNumbers = () => {
        const topics = topicList.querySelectorAll(':scope > .topic-item');
        topics.forEach((topic, topicIndex) => {
            const topicSlNumberInput = topic.querySelector('.sl-number');
            if (topicSlNumberInput) {
                topicSlNumberInput.value = topicIndex + 1;
            }

            const subtopics = topic.querySelectorAll('.subtopic-item');
            subtopics.forEach((subtopic, subtopicIndex) => {
                const subtopicSlNumberSpan = subtopic.querySelector('.sl-number-sub');
                if (subtopicSlNumberSpan) {
                    subtopicSlNumberSpan.textContent = `${topicIndex + 1}.${subtopicIndex + 1}`;
                }
                // Also update any associated task card
                updateTaskCardForSubtopic(subtopic);
            });
        });
    };
    
    /**
     * Sorts topics based on the value in their serial number input.
     */
    const sortTopics = () => {
        const topics = [...topicList.querySelectorAll(':scope > .topic-item')];
        topics.sort((a, b) => {
            const slA = parseInt(a.querySelector('.sl-number').value, 10) || 0;
            const slB = parseInt(b.querySelector('.sl-number').value, 10) || 0;
            return slA - slB;
        });
        topics.forEach(topic => topicList.appendChild(topic));
        updateSerialNumbers();
    };

    /**
     * Adds a new topic to the list.
     */
    const addTopic = () => {
        const topicText = newTopicInput.value.trim();
        if (!topicText) {
            alert('Please enter a topic title.');
            return;
        }

        const topicFragment = topicTemplate.content.cloneNode(true);
        const newTopic = topicFragment.querySelector('.topic-item');
        newTopic.querySelector('.topic-text').textContent = topicText;
        newTopic.dataset.id = `topic-${Date.now()}`;

        topicList.appendChild(newTopic);
        newTopicInput.value = '';
        updateSerialNumbers();
    };

    /**
     * Adds a new subtopic to a given topic element.
     * @param {HTMLElement} topicItem The topic element to add the subtopic to.
     */
    const addSubtopic = (topicItem) => {
        const subtopicText = prompt('Enter subtopic title:');
        if (!subtopicText || !subtopicText.trim()) return;

        const subtopicFragment = subtopicTemplate.content.cloneNode(true);
        const newSubtopic = subtopicFragment.querySelector('.subtopic-item');
        newSubtopic.querySelector('.subtopic-text').textContent = subtopicText.trim();
        newSubtopic.dataset.id = `subtopic-${Date.now()}`;

        const subtopicList = topicItem.querySelector('.subtopic-list');
        subtopicList.appendChild(newSubtopic);
        updateSerialNumbers();
    };
    
    /**
     * Toggles the contentEditable state for an element's text.
     * @param {HTMLElement} textElement The span element containing the text.
     */
    const toggleRewrite = (textElement) => {
        const isEditable = textElement.isContentEditable;
        textElement.contentEditable = !isEditable;
        if (!isEditable) {
            textElement.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(textElement);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            // On blur (losing focus), it becomes non-editable again
            // Also update any associated task card
            const subtopicItem = textElement.closest('.subtopic-item');
            if (subtopicItem) {
                updateTaskCardForSubtopic(subtopicItem);
            }
        }
    };

    /**
     * Moves an item to the recycle bin.
     * @param {HTMLElement} item The topic or subtopic item to delete.
     */
    const moveToRecycleBin = (item) => {
        const isTopic = item.classList.contains('topic-item');
        const text = item.querySelector(isTopic ? '.topic-text' : '.subtopic-text').textContent;
        
        const deletedItem = document.createElement('div');
        deletedItem.className = 'deleted-item';
        deletedItem.innerHTML = `<span class="deleted-item-text">${isTopic ? 'Topic' : 'Subtopic'}: ${text}</span> <button class="restore-btn">Restore</button>`;
        
        // Store the deleted node itself for easy restoration
        deletedItem.originalNode = item;
        
        // If it's a subtopic, remove its card from priority columns
        if (!isTopic) {
            const card = document.querySelector(`.task-card[data-subtopic-id="${item.dataset.id}"]`);
            if (card) card.remove();
        } else {
            // If it's a topic, remove all its subtopics' cards
            item.querySelectorAll('.subtopic-item').forEach(subtopic => {
                 const card = document.querySelector(`.task-card[data-subtopic-id="${subtopic.dataset.id}"]`);
                 if (card) card.remove();
            });
        }

        recycleBinList.appendChild(deletedItem);
        item.remove();
        updateSerialNumbers();
    };

    /**
     * Restores an item from the recycle bin.
     * @param {HTMLElement} deletedItemWrapper The wrapper div in the recycle bin.
     */
    const restoreFromRecycleBin = (deletedItemWrapper) => {
        const itemToRestore = deletedItemWrapper.originalNode;
        if (!itemToRestore) return;

        const isTopic = itemToRestore.classList.contains('topic-item');
        if (isTopic) {
            topicList.appendChild(itemToRestore);
            // Restore all subtopic cards
            itemToRestore.querySelectorAll('.subtopic-item').forEach(subtopic => {
                updateTaskCardForSubtopic(subtopic);
            });
        } else {
            // For simplicity, this implementation restores a subtopic to the first available topic.
            // A more robust solution would store the parent topic's ID on the subtopic.
            const firstTopicList = topicList.querySelector('.subtopic-list');
            if (firstTopicList) {
                firstTopicList.appendChild(itemToRestore);
                updateTaskCardForSubtopic(itemToRestore);
            } else {
                alert("Could not find a topic to restore this subtopic to. Please create a topic first.");
                return; // Don't remove from bin if it can't be restored
            }
        }
        
        deletedItemWrapper.remove();
        sortTopics(); // Re-sort and update numbers
    };
    
    /**
     * Updates or creates a task card in the priority columns for a given subtopic.
     * @param {HTMLElement} subtopicItem The subtopic element.
     */
    const updateTaskCardForSubtopic = (subtopicItem) => {
        const subtopicId = subtopicItem.dataset.id;
        const priority = subtopicItem.querySelector('.priority-dropdown').value;
        
        // Remove existing card first
        const existingCard = document.querySelector(`.task-card[data-subtopic-id="${subtopicId}"]`);
        if (existingCard) {
            existingCard.remove();
        }

        // If assigned to a column, create a new card
        if (priority !== 'none') {
            const targetColumn = document.getElementById(priority)?.querySelector('.task-card-container');
            if (!targetColumn) return;

            const cardFragment = taskCardTemplate.content.cloneNode(true);
            const newCard = cardFragment.querySelector('.task-card');
            
            const subtopicText = subtopicItem.querySelector('.subtopic-text').textContent;
            const topicText = subtopicItem.closest('.topic-item').querySelector('.topic-text').textContent;
            const subtopicSl = subtopicItem.querySelector('.sl-number-sub').textContent;

            newCard.querySelector('.card-text').textContent = subtopicText;
            newCard.querySelector('.card-topic-path').textContent = `${topicText} (${subtopicSl})`;
            newCard.dataset.subtopicId = subtopicId; // Link card to subtopic

            targetColumn.appendChild(newCard);
        }
    };

    // --- EVENT LISTENERS ---

    addTopicBtn.addEventListener('click', addTopic);
    newTopicInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') addTopic();
    });

    // Use event delegation for dynamically added elements
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const topicItem = target.closest('.topic-item');
        const subtopicItem = target.closest('.subtopic-item');

        if (target.classList.contains('add-subtopic-btn')) {
            addSubtopic(topicItem);
        } else if (target.classList.contains('rewrite-btn')) {
            const item = subtopicItem || topicItem;
            const textElement = item.querySelector('.topic-text, .subtopic-text');
            toggleRewrite(textElement);
        } else if (target.classList.contains('delete-btn')) {
            elementToDelete = subtopicItem || topicItem;
            deleteModal.style.display = 'flex';
        } else if (target.classList.contains('restore-btn')) {
            restoreFromRecycleBin(e.target.closest('.deleted-item'));
        }
    });
    
    document.body.addEventListener('change', (e) => {
        if (e.target.classList.contains('priority-dropdown')) {
            const subtopicItem = e.target.closest('.subtopic-item');
            updateTaskCardForSubtopic(subtopicItem);
        }
    });

    document.body.addEventListener('focusout', (e) => {
        if (e.target.matches('.topic-text, .subtopic-text') && e.target.isContentEditable) {
            toggleRewrite(e.target);
        }
    });
    
    document.body.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('[contenteditable="true"]')) {
            e.preventDefault();
            e.target.blur();
        }
        if (e.key === 'Enter' && e.target.classList.contains('sl-number')) {
            sortTopics();
            e.target.blur();
        }
    });

    // Modal listeners
    confirmDeleteBtn.addEventListener('click', () => {
        if (elementToDelete) moveToRecycleBin(elementToDelete);
        elementToDelete = null;
        deleteModal.style.display = 'none';
    });

    cancelDeleteBtn.addEventListener('click', () => {
        elementToDelete = null;
        deleteModal.style.display = 'none';
    });

    // --- DRAG AND DROP LOGIC ---
    
    const getDragAfterElement = (container, y) => {
        const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    document.addEventListener('dragstart', e => {
        if (e.target.matches('.topic-item, .subtopic-item, .task-card')) {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    document.addEventListener('dragend', e => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            updateSerialNumbers();
        }
    });

    document.addEventListener('dragover', e => {
        e.preventDefault();
        const container = e.target.closest('.droppable-list, .droppable-column');
        if (!container || !draggedItem) return;

        const isDraggedItemTopic = draggedItem.classList.contains('topic-item');
        const isDraggedItemSubtopic = draggedItem.classList.contains('subtopic-item');
        const isTargetTopicList = container.id === 'topic-list';
        const isTargetSubtopicList = container.classList.contains('subtopic-list');

        if ((isDraggedItemTopic && !isTargetTopicList) || (isDraggedItemSubtopic && !isTargetSubtopicList)) {
            return; // Invalid drop: can't drop topic in subtopic list or vice-versa
        }

        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
            container.appendChild(draggedItem);
        } else {
            container.insertBefore(draggedItem, afterElement);
        }
    });
});