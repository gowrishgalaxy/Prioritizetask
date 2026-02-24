document.addEventListener("DOMContentLoaded", () => {
    const defaultState = {
        topics: [],
        recycleBin: [],
        columns: {
            col1: { name: "Field_name_1", priority: 1 },
            col2: { name: "Field_name_2", priority: 2 },
            col3: { name: "Field_name_3", priority: 3 }
        },
        currentView: "task"
    };

    let state = structuredClone(defaultState);

    const taskView = document.getElementById("task-view");
    const prioritizeView = document.getElementById("prioritize-view");
    const taskViewLink = document.getElementById("view-task-btn");
    const prioritizeViewLink = document.getElementById("view-prioritize-btn");
    const topicList = document.getElementById("topic-list");
    const newTopicInput = document.getElementById("new-topic-input");
    const addTopicBtn = document.getElementById("add-topic-btn");
    const recycleBinFooter = document.getElementById("recycle-bin-footer");
    const recycleBinToggle = document.getElementById("recycle-bin-toggle");
    const recycleBinList = document.getElementById("recycle-bin-list");
    const binCount = document.getElementById("bin-count");
    const recycleBinDeleteAllBtn = document.getElementById("recycle-bin-delete-all-btn");
    const binDeleteModal = document.getElementById("bin-delete-modal");
    const binDeleteCancelBtn = document.getElementById("bin-delete-cancel-btn");
    const priorityMatrix = document.getElementById("priority-matrix");
    const addColumnBtn = document.getElementById("add-column-btn");
    let dragState = null;

    function saveState() {
        localStorage.setItem("prioritizeTaskState", JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem("prioritizeTaskState");
        if (!savedState) return;
        try {
            const parsed = JSON.parse(savedState);
            state = {
                ...state,
                ...parsed,
                columns: parsed.columns && Object.keys(parsed.columns).length ? parsed.columns : state.columns
            };
            normalizeState();
        } catch {
            state = structuredClone(defaultState);
        }
    }

    function generateId() {
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }

    function sanitize(text, fallback) {
        const value = (text || "").trim();
        return value.length ? value : fallback;
    }

    function getTopicById(topicId) {
        return state.topics.find((topic) => topic.id === topicId);
    }

    function getSubtopic(topic, subtopicId) {
        if (!topic || !Array.isArray(topic.subtopics)) return null;
        return topic.subtopics.find((subtopic) => subtopic.id === subtopicId) || null;
    }

    function toPriority(value, fallback = 1) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 1) return fallback;
        return parsed;
    }

    function normalizeColumns() {
        const normalized = {};
        const entries = Object.entries(state.columns || {});
        entries.forEach(([id, col], index) => {
            if (typeof col === "string") {
                normalized[id] = { name: col, priority: index + 1 };
                return;
            }
            normalized[id] = {
                name: sanitize(col?.name, `Field_name_${index + 1}`),
                priority: toPriority(col?.priority, index + 1)
            };
        });
        if (!Object.keys(normalized).length) {
            normalized.col1 = { name: "Field_name_1", priority: 1 };
        }
        state.columns = normalized;
    }

    function normalizeState() {
        normalizeColumns();
        state.topics = (state.topics || []).map((topic, index) => ({
            ...topic,
            priority: toPriority(topic.priority, index + 1),
            isOpen: Boolean(topic.isOpen),
            subtopics: (topic.subtopics || []).map((subtopic, subIndex) => ({
                ...subtopic,
                priority: toPriority(subtopic.priority, subIndex + 1),
                column: state.columns[subtopic.column] ? subtopic.column : Object.keys(state.columns)[0]
            }))
        }));
        sortAllByPriority();
        Object.keys(state.columns).forEach((columnId) => {
            resequenceColumnSubtopics(columnId);
        });
    }

    function sortSubtopics(topic) {
        topic.subtopics.sort((a, b) => {
            return toPriority(a.priority) - toPriority(b.priority) || sanitize(a.text, "").localeCompare(sanitize(b.text, ""));
        });
    }

    function sortTopics() {
        state.topics.forEach((topic) => {
            topic.priority = toPriority(topic.priority);
            sortSubtopics(topic);
        });
        state.topics.sort((a, b) => {
            return toPriority(a.priority) - toPriority(b.priority) || sanitize(a.text, "").localeCompare(sanitize(b.text, ""));
        });
    }

    function sortColumns() {
        const sortedEntries = Object.entries(state.columns).sort((a, b) => {
            return toPriority(a[1].priority) - toPriority(b[1].priority) || sanitize(a[1].name, "").localeCompare(sanitize(b[1].name, ""));
        });
        state.columns = sortedEntries.reduce((acc, [id, col]) => {
            acc[id] = col;
            return acc;
        }, {});
    }

    function sortAllByPriority() {
        sortTopics();
        sortColumns();
    }

    function moveSubtopicToTopic(subtopicId, fromTopicId, toTopicId, targetSubtopicId = null) {
        const fromTopic = getTopicById(fromTopicId);
        const toTopic = getTopicById(toTopicId);
        if (!fromTopic || !toTopic || !Array.isArray(fromTopic.subtopics)) return;

        const fromIndex = fromTopic.subtopics.findIndex((subtopic) => subtopic.id === subtopicId);
        if (fromIndex < 0) return;

        const [moved] = fromTopic.subtopics.splice(fromIndex, 1);
        toTopic.subtopics ||= [];

        if (targetSubtopicId) {
            const targetIndex = toTopic.subtopics.findIndex((subtopic) => subtopic.id === targetSubtopicId);
            if (targetIndex >= 0) {
                toTopic.subtopics.splice(targetIndex, 0, moved);
            } else {
                toTopic.subtopics.push(moved);
            }
        } else {
            toTopic.subtopics.push(moved);
        }

        resequenceColumnSubtopics(moved.column);
    }

    function moveSubtopicToColumn(subtopicId, parentTopicId, targetColumnId) {
        if (!state.columns[targetColumnId]) return;
        const topic = getTopicById(parentTopicId);
        const subtopic = getSubtopic(topic, subtopicId);
        if (!subtopic) return;
        const sourceColumnId = subtopic.column;
        if (sourceColumnId === targetColumnId) return;

        const targetColumnCount = state.topics.reduce((count, currentTopic) => {
            const matches = (currentTopic.subtopics || []).filter((entry) => entry.column === targetColumnId).length;
            return count + matches;
        }, 0);

        subtopic.column = targetColumnId;
        subtopic.priority = targetColumnCount + 1;
        resequenceColumnSubtopics(sourceColumnId);
        resequenceColumnSubtopics(targetColumnId);
    }

    function resequenceColumnSubtopics(columnId) {
        if (!columnId) return;
        const columnSubtopics = [];
        state.topics.forEach((topic) => {
            (topic.subtopics || []).forEach((subtopic) => {
                if (subtopic.column === columnId) {
                    columnSubtopics.push(subtopic);
                }
            });
        });

        columnSubtopics
            .sort((a, b) => toPriority(a.priority) - toPriority(b.priority) || sanitize(a.text, "").localeCompare(sanitize(b.text, "")))
            .forEach((subtopic, index) => {
                subtopic.priority = index + 1;
            });
    }

    function reprioritizeSubtopicInField(topicId, subtopicId, newPriority) {
        const topic = getTopicById(topicId);
        const subtopic = getSubtopic(topic, subtopicId);
        if (!subtopic) return;
        const columnId = subtopic.column;
        if (!columnId) return;

        const fieldSubtopics = [];
        state.topics.forEach((currentTopic) => {
            (currentTopic.subtopics || []).forEach((currentSubtopic) => {
                if (currentSubtopic.column === columnId) {
                    fieldSubtopics.push(currentSubtopic);
                }
            });
        });

        const sorted = fieldSubtopics.sort((a, b) => {
            return toPriority(a.priority) - toPriority(b.priority) || sanitize(a.text, "").localeCompare(sanitize(b.text, ""));
        });

        const fromIndex = sorted.findIndex((entry) => entry.id === subtopicId);
        if (fromIndex < 0) return;
        const toIndex = clampPriorityPosition(newPriority, sorted.length) - 1;
        const [moved] = sorted.splice(fromIndex, 1);
        sorted.splice(toIndex, 0, moved);
        sorted.forEach((entry, index) => {
            entry.priority = index + 1;
        });
    }

    function clampPriorityPosition(value, length) {
        const parsed = toPriority(value, 1);
        if (length < 1) return 1;
        return Math.min(Math.max(parsed, 1), length);
    }

    function reprioritizeTopics(topicId, newPriority) {
        const sorted = [...state.topics].sort((a, b) => {
            return toPriority(a.priority) - toPriority(b.priority) || sanitize(a.text, "").localeCompare(sanitize(b.text, ""));
        });
        const fromIndex = sorted.findIndex((topic) => topic.id === topicId);
        if (fromIndex < 0) return;
        const toIndex = clampPriorityPosition(newPriority, sorted.length) - 1;
        const [moved] = sorted.splice(fromIndex, 1);
        sorted.splice(toIndex, 0, moved);
        sorted.forEach((topic, index) => {
            topic.priority = index + 1;
        });
        state.topics = sorted;
    }

    function reprioritizeSubtopics(topicId, subtopicId, newPriority) {
        reprioritizeSubtopicInField(topicId, subtopicId, newPriority);
    }

    function reprioritizeColumns(columnId, newPriority) {
        const entries = Object.entries(state.columns).sort((a, b) => {
            return toPriority(a[1].priority) - toPriority(b[1].priority) || sanitize(a[1].name, "").localeCompare(sanitize(b[1].name, ""));
        });
        const fromIndex = entries.findIndex(([id]) => id === columnId);
        if (fromIndex < 0) return;
        const toIndex = clampPriorityPosition(newPriority, entries.length) - 1;
        const [moved] = entries.splice(fromIndex, 1);
        entries.splice(toIndex, 0, moved);
        entries.forEach(([, col], index) => {
            col.priority = index + 1;
        });
        state.columns = entries.reduce((acc, [id, col]) => {
            acc[id] = col;
            return acc;
        }, {});
    }

    function getSortedColumns() {
        return Object.entries(state.columns).sort((a, b) => {
            return toPriority(a[1].priority) - toPriority(b[1].priority) || sanitize(a[1].name, "").localeCompare(sanitize(b[1].name, ""));
        });
    }

    function switchView(view) {
        state.currentView = view;
        const showTask = view === "task";
        taskView.style.display = showTask ? "block" : "none";
        prioritizeView.style.display = showTask ? "none" : "block";
        taskView.classList.toggle("active", showTask);
        prioritizeView.classList.toggle("active", !showTask);
        taskViewLink.classList.toggle("active", showTask);
        prioritizeViewLink.classList.toggle("active", !showTask);
        render();
    }

    function render() {
        sortAllByPriority();
        Object.keys(state.columns).forEach((columnId) => {
            resequenceColumnSubtopics(columnId);
        });
        renderTopicList();
        renderPriorityMatrix();
        renderRecycleBin();
        saveState();
    }

    function renderTopicList() {
        topicList.innerHTML = "";

        state.topics.forEach((topic) => {
            const topicItem = document.createElement("li");
            topicItem.className = `topic-item ${topic.isOpen ? "open" : ""}`;
            topicItem.dataset.id = topic.id;

            topicItem.innerHTML = `
                <div class="item-content">
                    <input type="number" class="item-priority" min="1" value="${topic.priority || 1}" title="Priority number">
                    <span class="accordion-toggle">${topic.isOpen ? "v" : ">"}</span>
                    <span class="item-text" contenteditable="true" spellcheck="false">${topic.text}</span>
                </div>
                <div class="item-actions">
                    <button class="add-subtopic-btn" title="Add subtopic">+</button>
                    <button class="delete-btn" title="Delete topic">x</button>
                </div>
            `;
            topicList.appendChild(topicItem);

            const subtopicList = document.createElement("ul");
            subtopicList.className = "subtopic-list";
            subtopicList.dataset.topicId = topic.id;
            if (topic.isOpen) subtopicList.style.display = "block";

            (topic.subtopics || []).forEach((subtopic) => {
                let fieldOptions = "";
                getSortedColumns().forEach(([colId, col]) => {
                    const selected = subtopic.column === colId ? "selected" : "";
                    fieldOptions += `<option value="${colId}" ${selected}>${col.name}</option>`;
                });
                const subtopicItem = document.createElement("li");
                subtopicItem.className = "subtopic-item";
                subtopicItem.dataset.id = subtopic.id;
                subtopicItem.dataset.parentId = topic.id;
                subtopicItem.draggable = true;
                subtopicItem.innerHTML = `
                    <div class="item-content">
                        <input type="number" class="item-priority" min="1" value="${subtopic.priority || 1}" title="Priority number">
                        <span class="item-text" contenteditable="true" spellcheck="false">${subtopic.text}</span>
                        <select class="subtopic-field-select" title="Select field">
                            ${fieldOptions}
                        </select>
                    </div>
                    <div class="item-actions">
                        <button class="delete-btn" title="Delete subtopic">x</button>
                    </div>
                `;
                subtopicList.appendChild(subtopicItem);
            });
            topicList.appendChild(subtopicList);

            const addSubtopicForm = document.createElement("div");
            addSubtopicForm.className = "add-subtopic-form";
            addSubtopicForm.dataset.topicId = topic.id;
            let options = "";
            getSortedColumns().forEach(([colId, col]) => {
                options += `<option value="${colId}">${col.name}</option>`;
            });
            addSubtopicForm.innerHTML = `
                <input type="text" class="new-subtopic-input" placeholder="New subtopic">
                <select class="column-select">${options}</select>
                <button class="save-subtopic-btn">Save</button>
            `;
            topicList.appendChild(addSubtopicForm);
        });
    }

    function renderPriorityMatrix() {
        priorityMatrix.innerHTML = "";

        getSortedColumns().forEach(([colId, col]) => {
            const column = document.createElement("div");
            column.className = "priority-column";
            column.dataset.id = colId;
            column.innerHTML = `
                <div class="priority-column-header">
                    <input type="number" class="item-priority column-priority" min="1" value="${toPriority(col.priority)}" title="Column order">
                    <h3 contenteditable="true" spellcheck="false">${col.name}</h3>
                    <button class="delete-column-btn" title="Delete field">x</button>
                </div>
                <ul class="subtopic-drop-list"></ul>
            `;
            priorityMatrix.appendChild(column);
        });

        const matrixItemsByColumn = {};
        state.topics.forEach((topic) => {
            (topic.subtopics || []).forEach((subtopic) => {
                const colId = subtopic.column;
                if (!matrixItemsByColumn[colId]) matrixItemsByColumn[colId] = [];
                matrixItemsByColumn[colId].push({
                    topicId: topic.id,
                    topicText: topic.text,
                    subtopic
                });
            });
        });

        Object.entries(matrixItemsByColumn).forEach(([colId, entries]) => {
            entries.sort((a, b) => {
                return toPriority(a.subtopic.priority) - toPriority(b.subtopic.priority) ||
                    sanitize(a.subtopic.text, "").localeCompare(sanitize(b.subtopic.text, ""));
            });

            const targetColumn = priorityMatrix.querySelector(`[data-id="${colId}"] .subtopic-drop-list`);
            if (!targetColumn) return;
            entries.forEach(({ topicId, topicText, subtopic }) => {
                let fieldOptions = "";
                getSortedColumns().forEach(([optionColId, optionCol]) => {
                    const selected = subtopic.column === optionColId ? "selected" : "";
                    fieldOptions += `<option value="${optionColId}" ${selected}>${optionCol.name}</option>`;
                });
                const item = document.createElement("li");
                item.className = "matrix-subtopic";
                item.dataset.id = subtopic.id;
                item.dataset.parentId = topicId;
                item.draggable = true;
                item.innerHTML = `
                    <div class="matrix-item-content">
                        <input type="number" class="item-priority" min="1" value="${subtopic.priority || 1}" title="Priority number">
                        <span class="matrix-item-text" contenteditable="true" spellcheck="false">${subtopic.text}</span>
                        <select class="matrix-field-select" title="Change field">
                            ${fieldOptions}
                        </select>
                    </div>
                    <span class="topic-ref">${topicText}</span>
                `;
                targetColumn.appendChild(item);
            });
        });
    }

    function renderRecycleBin() {
        recycleBinList.innerHTML = "";
        binCount.textContent = `(${state.recycleBin.length})`;
        recycleBinDeleteAllBtn.disabled = state.recycleBin.length === 0;
        state.recycleBin.forEach((item) => {
            const li = document.createElement("li");
            li.className = "deleted-item";
            li.dataset.id = item.id;
            li.innerHTML = `
                <span class="item-text">${item.text} <span class="item-type">(${item.type})</span></span>
                <button class="restore-btn" title="Restore">undo</button>
            `;
            recycleBinList.appendChild(li);
        });
    }

    function openDeleteBinModal() {
        if (!state.recycleBin.length) return;
        binDeleteModal.classList.remove("hidden");
        binDeleteModal.setAttribute("aria-hidden", "false");
    }

    function closeDeleteBinModal() {
        binDeleteModal.classList.add("hidden");
        binDeleteModal.setAttribute("aria-hidden", "true");
    }

    function clearRecycleBin(scope) {
        if (scope === "all") {
            state.recycleBin = [];
            render();
            return;
        }
        state.recycleBin = state.recycleBin.filter((item) => item.type !== scope);
        render();
    }

    function addTopic() {
        const text = sanitize(newTopicInput.value, "");
        if (!text) return;
        state.topics.push({
            id: generateId(),
            text,
            priority: state.topics.length + 1,
            isOpen: true,
            subtopics: []
        });
        newTopicInput.value = "";
        render();
    }

    function addSubtopic(topicId, text, column) {
        const topic = getTopicById(topicId);
        if (!topic) return;
        const cleanText = sanitize(text, "");
        if (!cleanText) return;
        topic.subtopics ||= [];
        const targetColumnId = column || Object.keys(state.columns)[0];
        const targetColumnCount = state.topics.reduce((count, currentTopic) => {
            const matches = (currentTopic.subtopics || []).filter((entry) => entry.column === targetColumnId).length;
            return count + matches;
        }, 0);
        topic.subtopics.push({
            id: generateId(),
            text: cleanText,
            priority: targetColumnCount + 1,
            column: targetColumnId
        });
        resequenceColumnSubtopics(targetColumnId);
        render();
    }

    function deleteTopic(topicId) {
        const topicIndex = state.topics.findIndex((topic) => topic.id === topicId);
        if (topicIndex < 0) return;
        const [topic] = state.topics.splice(topicIndex, 1);
        state.recycleBin.push({
            ...topic,
            type: "topic",
            subtopics: topic.subtopics || []
        });
        render();
    }

    function deleteSubtopic(topicId, subtopicId) {
        const topic = getTopicById(topicId);
        if (!topic || !Array.isArray(topic.subtopics)) return;
        const idx = topic.subtopics.findIndex((subtopic) => subtopic.id === subtopicId);
        if (idx < 0) return;
        const [subtopic] = topic.subtopics.splice(idx, 1);
        state.recycleBin.push({
            ...subtopic,
            type: "subtopic",
            parentId: topicId
        });
        render();
    }

    function deleteColumn(colId) {
        if (!state.columns[colId]) return;
        const deletedColumn = {
            id: colId,
            type: "column",
            text: state.columns[colId].name,
            priority: state.columns[colId].priority,
            subtopics: []
        };
        delete state.columns[colId];

        state.topics.forEach((topic) => {
            const kept = [];
            (topic.subtopics || []).forEach((subtopic) => {
                if (subtopic.column === colId) {
                    deletedColumn.subtopics.push({
                        ...subtopic,
                        parentId: topic.id
                    });
                } else {
                    kept.push(subtopic);
                }
            });
            topic.subtopics = kept;
        });
        state.recycleBin.push(deletedColumn);

        if (!Object.keys(state.columns).length) {
            const fallbackId = `col${generateId()}`;
            state.columns[fallbackId] = { name: "Field_name_1", priority: 1 };
        }
        render();
    }

    function restoreItem(itemId) {
        const idx = state.recycleBin.findIndex((item) => item.id === itemId);
        if (idx < 0) return;
        const [item] = state.recycleBin.splice(idx, 1);

        if (item.type === "topic") {
            const { type, ...restoredTopic } = item;
            state.topics.push({
                ...restoredTopic,
                subtopics: restoredTopic.subtopics || []
            });
            render();
            return;
        }

        if (item.type === "column") {
            state.columns[item.id] = { name: item.text || "Field", priority: toPriority(item.priority, Object.keys(state.columns).length + 1) };

            (item.subtopics || []).forEach((subtopic) => {
                let topic = getTopicById(subtopic.parentId);
                if (!topic) {
                    topic = {
                        id: subtopic.parentId || generateId(),
                        text: "Restored Topic",
                        priority: state.topics.length + 1,
                        isOpen: true,
                        subtopics: []
                    };
                    state.topics.push(topic);
                }
                topic.subtopics ||= [];
                topic.subtopics.push({
                    id: subtopic.id,
                    text: subtopic.text,
                    priority: toPriority(subtopic.priority, topic.subtopics.length + 1),
                    column: item.id
                });
            });

            render();
            return;
        }

        if (item.type === "subtopic") {
            let topic = getTopicById(item.parentId);
            if (!topic) {
                topic = {
                    id: item.parentId || generateId(),
                    text: "Restored Topic",
                    priority: 1,
                    isOpen: true,
                    subtopics: []
                };
                state.topics.push(topic);
            }
            if (!state.columns[item.column]) {
                const fallbackId = Object.keys(state.columns)[0];
                item.column = fallbackId;
            }
            topic.subtopics.push({
                ...item,
                type: undefined,
                parentId: undefined
            });
        }
        render();
    }

    function addColumn() {
        const nextIndex = Object.keys(state.columns).length + 1;
        const id = `col${generateId()}`;
        state.columns[id] = { name: `Field_name_${nextIndex}`, priority: nextIndex };
        render();
    }

    taskViewLink.addEventListener("click", (event) => {
        event.preventDefault();
        switchView("task");
    });

    prioritizeViewLink.addEventListener("click", (event) => {
        event.preventDefault();
        switchView("prioritize");
    });

    addTopicBtn.addEventListener("click", addTopic);
    newTopicInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") addTopic();
    });

    topicList.addEventListener("click", (event) => {
        const topicItem = event.target.closest(".topic-item");
        const subtopicItem = event.target.closest(".subtopic-item");
        const form = event.target.closest(".add-subtopic-form");

        if (event.target.classList.contains("accordion-toggle") && topicItem) {
            const topic = getTopicById(topicItem.dataset.id);
            if (!topic) return;
            topic.isOpen = !topic.isOpen;
            render();
            return;
        }

        if (event.target.classList.contains("add-subtopic-btn") && topicItem) {
            const nextForm = topicItem.nextElementSibling?.nextElementSibling;
            if (nextForm && nextForm.classList.contains("add-subtopic-form")) {
                nextForm.classList.toggle("show");
            }
            return;
        }

        if (event.target.classList.contains("save-subtopic-btn") && form) {
            const textInput = form.querySelector(".new-subtopic-input");
            const select = form.querySelector(".column-select");
            addSubtopic(form.dataset.topicId, textInput.value, select.value);
            textInput.value = "";
            form.classList.remove("show");
            return;
        }

        if (event.target.classList.contains("delete-btn") && topicItem) {
            deleteTopic(topicItem.dataset.id);
            return;
        }

        if (event.target.classList.contains("delete-btn") && subtopicItem) {
            deleteSubtopic(subtopicItem.dataset.parentId, subtopicItem.dataset.id);
        }
    });

    topicList.addEventListener("dragstart", (event) => {
        const subtopicItem = event.target.closest(".subtopic-item");
        if (!subtopicItem) return;
        dragState = {
            type: "task-subtopic",
            subtopicId: subtopicItem.dataset.id,
            fromTopicId: subtopicItem.dataset.parentId
        };
        subtopicItem.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
    });

    topicList.addEventListener("dragend", (event) => {
        const subtopicItem = event.target.closest(".subtopic-item");
        if (subtopicItem) subtopicItem.classList.remove("dragging");
        dragState = null;
    });

    topicList.addEventListener("dragover", (event) => {
        if (!dragState || dragState.type !== "task-subtopic") return;
        const canDrop = event.target.closest(".topic-item") || event.target.closest(".subtopic-list") || event.target.closest(".subtopic-item");
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });

    topicList.addEventListener("drop", (event) => {
        if (!dragState || dragState.type !== "task-subtopic") return;
        const topicItem = event.target.closest(".topic-item");
        const subtopicList = event.target.closest(".subtopic-list");
        const targetSubtopic = event.target.closest(".subtopic-item");
        const targetTopicId = targetSubtopic?.dataset.parentId || subtopicList?.dataset.topicId || topicItem?.dataset.id;
        if (!targetTopicId) return;
        event.preventDefault();
        moveSubtopicToTopic(
            dragState.subtopicId,
            dragState.fromTopicId,
            targetTopicId,
            targetSubtopic?.dataset.id || null
        );
        render();
    });

    topicList.addEventListener("change", (event) => {
        const target = event.target;
        const subtopicItem = target.closest(".subtopic-item");

        if (target.classList.contains("subtopic-field-select")) {
            if (!subtopicItem) return;
            const topic = getTopicById(subtopicItem.dataset.parentId);
            const subtopic = getSubtopic(topic, subtopicItem.dataset.id);
            if (!subtopic || !state.columns[target.value]) return;
            moveSubtopicToColumn(subtopic.id, subtopicItem.dataset.parentId, target.value);
            render();
            return;
        }

        if (!target.classList.contains("item-priority")) return;
        const item = target.closest(".topic-item, .subtopic-item");
        if (!item) return;
        const priority = toPriority(target.value, 1);

        if (item.classList.contains("topic-item")) {
            reprioritizeTopics(item.dataset.id, priority);
        } else {
            reprioritizeSubtopics(item.dataset.parentId, item.dataset.id, priority);
        }
        render();
    });

    topicList.addEventListener("focusout", (event) => {
        const editable = event.target.closest(".item-text");
        if (!editable) return;
        const item = editable.closest(".topic-item, .subtopic-item");
        if (!item) return;
        const text = sanitize(editable.textContent, "Untitled");
        editable.textContent = text;

        if (item.classList.contains("topic-item")) {
            const topic = getTopicById(item.dataset.id);
            if (topic) topic.text = text;
        } else {
            const topic = getTopicById(item.dataset.parentId);
            const subtopic = getSubtopic(topic, item.dataset.id);
            if (subtopic) subtopic.text = text;
        }
        saveState();
    });

    priorityMatrix.addEventListener("click", (event) => {
        if (!event.target.classList.contains("delete-column-btn")) return;
        const col = event.target.closest(".priority-column");
        if (!col) return;
        deleteColumn(col.dataset.id);
    });

    priorityMatrix.addEventListener("change", (event) => {
        const target = event.target;
        if (!target.classList.contains("item-priority")) return;

        if (target.classList.contains("column-priority")) {
            const col = target.closest(".priority-column");
            if (!col || !state.columns[col.dataset.id]) return;
            const priority = toPriority(target.value, 1);
            reprioritizeColumns(col.dataset.id, priority);
            render();
            return;
        }

        const matrixItem = target.closest(".matrix-subtopic");
        if (!matrixItem) return;
        const priority = toPriority(target.value, 1);
        reprioritizeSubtopics(matrixItem.dataset.parentId, matrixItem.dataset.id, priority);
        render();
    });

    priorityMatrix.addEventListener("focusout", (event) => {
        if (event.target.classList.contains("matrix-item-text")) {
            const matrixItem = event.target.closest(".matrix-subtopic");
            if (!matrixItem) return;
            const topic = getTopicById(matrixItem.dataset.parentId);
            const subtopic = getSubtopic(topic, matrixItem.dataset.id);
            if (!subtopic) return;
            const text = sanitize(event.target.textContent, "Untitled");
            event.target.textContent = text;
            subtopic.text = text;
            saveState();
            return;
        }

        if (event.target.tagName !== "H3") return;
        const col = event.target.closest(".priority-column");
        if (!col) return;
        state.columns[col.dataset.id].name = sanitize(event.target.textContent, "Field");
        saveState();
    });

    priorityMatrix.addEventListener("dragstart", (event) => {
        const matrixItem = event.target.closest(".matrix-subtopic");
        if (!matrixItem) return;
        const column = matrixItem.closest(".priority-column");
        if (!column) return;
        dragState = {
            type: "matrix-subtopic",
            subtopicId: matrixItem.dataset.id,
            parentTopicId: matrixItem.dataset.parentId,
            fromColumnId: column.dataset.id
        };
        matrixItem.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
    });

    priorityMatrix.addEventListener("dragend", (event) => {
        const matrixItem = event.target.closest(".matrix-subtopic");
        if (matrixItem) matrixItem.classList.remove("dragging");
        dragState = null;
    });

    priorityMatrix.addEventListener("dragover", (event) => {
        if (!dragState || dragState.type !== "matrix-subtopic") return;
        const column = event.target.closest(".priority-column");
        if (!column) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });

    priorityMatrix.addEventListener("drop", (event) => {
        if (!dragState || dragState.type !== "matrix-subtopic") return;
        const column = event.target.closest(".priority-column");
        if (!column) return;
        event.preventDefault();
        moveSubtopicToColumn(dragState.subtopicId, dragState.parentTopicId, column.dataset.id);
        render();
    });

    priorityMatrix.addEventListener("change", (event) => {
        const target = event.target;
        if (!target.classList.contains("matrix-field-select")) return;
        const matrixItem = target.closest(".matrix-subtopic");
        if (!matrixItem) return;
        const topic = getTopicById(matrixItem.dataset.parentId);
        const subtopic = getSubtopic(topic, matrixItem.dataset.id);
        if (!subtopic || !state.columns[target.value]) return;
        moveSubtopicToColumn(subtopic.id, matrixItem.dataset.parentId, target.value);
        render();
    });

    recycleBinList.addEventListener("click", (event) => {
        if (!event.target.classList.contains("restore-btn")) return;
        const item = event.target.closest(".deleted-item");
        if (item) restoreItem(item.dataset.id);
    });

    addColumnBtn.addEventListener("click", addColumn);
    recycleBinDeleteAllBtn.addEventListener("click", openDeleteBinModal);
    binDeleteCancelBtn.addEventListener("click", closeDeleteBinModal);
    binDeleteModal.addEventListener("click", (event) => {
        if (event.target === binDeleteModal) closeDeleteBinModal();
    });
    binDeleteModal.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-delete-scope]");
        if (!btn) return;
        const scope = btn.dataset.deleteScope;
        clearRecycleBin(scope);
        closeDeleteBinModal();
    });
    recycleBinToggle.addEventListener("click", () => {
        recycleBinFooter.classList.toggle("expanded");
        recycleBinFooter.classList.toggle("collapsed");
    });

    loadState();
    normalizeState();
    switchView(state.currentView);
});
