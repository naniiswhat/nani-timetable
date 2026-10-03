document.addEventListener('DOMContentLoaded', () => {
    // --- Data Models ---
    let classes = JSON.parse(localStorage.getItem('geoTableData')) || [];
    let editingClassId = null;
    let breakSettings = JSON.parse(localStorage.getItem('breakSettings')) || { start: '13:00', end: '13:50' };

    // Core Themes
    const BUILTIN_THEMES = {
        'geo': { name: 'Geo (Dark)', bg: '#181411', card: '#211b16', accent: '#db9d35', border: '#2e2620', text: '#f3ece2' },
        'march7th': { name: 'March 7th', bg: '#fcf5f7', card: '#ffffff', accent: '#f4a5b9', border: '#f2e1e6', text: '#4a3c40' }
    };

    // User stored themes & active configuration
    let userThemes = JSON.parse(localStorage.getItem('userThemes')) || {};
    let activeColors = JSON.parse(localStorage.getItem('activeColors')) || BUILTIN_THEMES['geo'];

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const DAY_START_MINS = 8 * 60;
    const TOTAL_DAY_MINS = 10 * 60;

    // --- DOM Elements ---
    const gridBody = document.getElementById('gridBody');
    const mobileList = document.getElementById('mobileList');

    // Modals
    const classModalOverlay = document.getElementById('modalOverlay');
    const classForm = document.getElementById('classForm');
    const classModalTitle = document.getElementById('classModalTitle');
    const themeModalOverlay = document.getElementById('themeModalOverlay');
    const themeForm = document.getElementById('themeForm');

    // --- Theme Engine ---
    function applyColorsToDOM(colors) {
        const root = document.documentElement;
        root.style.setProperty('--bg', colors.bg);
        root.style.setProperty('--card-bg', colors.card);
        root.style.setProperty('--accent', colors.accent);
        root.style.setProperty('--border', colors.border);
        root.style.setProperty('--text-main', colors.text);

        // Derive secondary UI colors dynamically
        root.style.setProperty('--day-label-bg', colors.card);
        root.style.setProperty('--header-bg', colors.bg);
        root.style.setProperty('--text-muted', colors.text + '99'); // Appends hex transparency
        root.style.setProperty('--break-bg', `repeating-linear-gradient(45deg, transparent, transparent 10px, ${colors.text}1a 10px, ${colors.text}1a 20px)`);
    }

    function syncPickersToColors(colors) {
        document.getElementById('customBg').value = colors.bg;
        document.getElementById('customCard').value = colors.card;
        document.getElementById('customAccent').value = colors.accent;
        document.getElementById('customBorder').value = colors.border;
        document.getElementById('customText').value = colors.text;
    }

    function renderThemePresets() {
        const container = document.getElementById('presetContainer');
        container.innerHTML = '';

        // Render Built-in Themes
        Object.keys(BUILTIN_THEMES).forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary preset-btn';
            btn.textContent = BUILTIN_THEMES[key].name;
            btn.onclick = () => syncPickersToColors(BUILTIN_THEMES[key]);
            container.appendChild(btn);
        });

        // Render User Saved Themes
        Object.keys(userThemes).forEach(key => {
            const wrapper = document.createElement('div');
            wrapper.className = 'user-preset-wrapper';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary preset-btn';
            btn.textContent = userThemes[key].name;
            btn.onclick = () => syncPickersToColors(userThemes[key]);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'delete-preset-btn';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Delete theme';
            delBtn.onclick = (e) => {
                e.stopPropagation(); // Prevents button underneath from triggering
                delete userThemes[key];
                localStorage.setItem('userThemes', JSON.stringify(userThemes));
                renderThemePresets();
            };

            wrapper.appendChild(btn);
            wrapper.appendChild(delBtn);
            container.appendChild(wrapper);
        });
    }

    // Apply colors on initial load
    applyColorsToDOM(activeColors);

    // Opening Settings Modal
    document.getElementById('themeSettingsBtn').addEventListener('click', () => {
        syncPickersToColors(activeColors); // Set pickers to current active colors
        document.getElementById('breakStart').value = breakSettings.start;
        document.getElementById('breakEnd').value = breakSettings.end;
        renderThemePresets();
        themeModalOverlay.classList.remove('hidden');
    });

    document.getElementById('closeThemeBtn').addEventListener('click', () => {
        themeModalOverlay.classList.add('hidden');
    });

    // Save as New Preset Button
    document.getElementById('savePresetBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('newThemeName');
        const themeName = nameInput.value.trim() || 'Custom Theme';
        const newId = 'theme_' + Date.now();

        const newPresetColors = {
            bg: document.getElementById('customBg').value,
            card: document.getElementById('customCard').value,
            accent: document.getElementById('customAccent').value,
            border: document.getElementById('customBorder').value,
            text: document.getElementById('customText').value
        };

        userThemes[newId] = { name: themeName, ...newPresetColors };
        localStorage.setItem('userThemes', JSON.stringify(userThemes));

        nameInput.value = ''; // Reset input
        renderThemePresets(); // Refresh buttons
    });

    // Apply & Save Settings Form
    themeForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const bStart = document.getElementById('breakStart').value;
        const bEnd = document.getElementById('breakEnd').value;

        if (timeToMinutes(bEnd) <= timeToMinutes(bStart)) {
            alert("Break end time must be after start time!");
            return;
        }

        breakSettings = { start: bStart, end: bEnd };

        // Grab whatever is currently sitting in the color pickers
        activeColors = {
            bg: document.getElementById('customBg').value,
            card: document.getElementById('customCard').value,
            accent: document.getElementById('customAccent').value,
            border: document.getElementById('customBorder').value,
            text: document.getElementById('customText').value
        };

        localStorage.setItem('activeColors', JSON.stringify(activeColors));
        localStorage.setItem('breakSettings', JSON.stringify(breakSettings));

        applyColorsToDOM(activeColors);
        saveAndRender();
        themeModalOverlay.classList.add('hidden');
    });


    // --- Core Timetable Matrix Logic ---
    function saveAndRender() {
        localStorage.setItem('geoTableData', JSON.stringify(classes));
        renderMatrix();
        renderMobileList();
        attachActionListeners();
    }

    function timeToMinutes(timeStr) {
        const [hours, mins] = timeStr.split(':').map(Number);
        return (hours * 60) + mins;
    }

    function formatTime(time24) {
        const [hour, min] = time24.split(':');
        let h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${min} ${ampm}`;
    }

    function renderMatrix() {
        const breakCol = gridBody.querySelector('.break-column');

        const bStartMins = timeToMinutes(breakSettings.start);
        const bEndMins = timeToMinutes(breakSettings.end);
        let bLeft = (bStartMins - DAY_START_MINS) / TOTAL_DAY_MINS;
        let bWidth = (bEndMins - bStartMins) / TOTAL_DAY_MINS;

        if (bLeft < 0) bLeft = 0;
        if (bLeft + bWidth > 1) bWidth = 1 - bLeft;

        breakCol.style.left = `calc(100px + (100% - 100px) * ${bLeft})`;
        breakCol.style.width = `calc((100% - 100px) * ${bWidth})`;

        const breakHtml = breakCol.outerHTML;
        gridBody.innerHTML = breakHtml;

        days.forEach(day => {
            const row = document.createElement('div');
            row.className = 'day-row';

            const label = document.createElement('div');
            label.className = 'day-label';
            label.textContent = day.substring(0, 3);
            row.appendChild(label);

            const track = document.createElement('div');
            track.className = 'day-track';

            const dayClasses = classes.filter(c => c.day === day);

            dayClasses.forEach(c => {
                const startMins = timeToMinutes(c.startTime);
                const endMins = timeToMinutes(c.endTime);

                let leftPercent = ((startMins - DAY_START_MINS) / TOTAL_DAY_MINS) * 100;
                let widthPercent = ((endMins - startMins) / TOTAL_DAY_MINS) * 100;

                if (leftPercent < 0) leftPercent = 0;
                if (leftPercent + widthPercent > 100) widthPercent = 100 - leftPercent;

                const block = document.createElement('div');
                block.className = 'class-block';
                block.style.left = `${leftPercent}%`;
                block.style.width = `${widthPercent}%`;

                block.innerHTML = `
                    <div class="action-btns">
                        <button class="action-btn edit" data-id="${c.id}">✎</button>
                        <button class="action-btn delete" data-id="${c.id}">&times;</button>
                    </div>
                    <div class="class-subject">${c.subject}</div>
                    <div class="class-meta">${formatTime(c.startTime)} - ${formatTime(c.endTime)}</div>
                    <div class="class-meta">${c.location}</div>
                `;
                track.appendChild(block);
            });
            row.appendChild(track);
            gridBody.appendChild(row);
        });
    }

    function renderMobileList() {
        mobileList.innerHTML = '';
        days.forEach(day => {
            const dayClasses = classes.filter(c => c.day === day).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            const card = document.createElement('div');
            card.className = 'mobile-day-card';

            let html = `<div class="mobile-day-header">${day}</div>`;

            if (dayClasses.length === 0) {
                html += `<div class="empty-day">No classes scheduled.</div>`;
            } else {
                dayClasses.forEach(c => {
                    html += `
                        <div class="mobile-class-item">
                            <div class="action-btns">
                                <button class="action-btn edit" data-id="${c.id}">✎</button>
                                <button class="action-btn delete" data-id="${c.id}">&times;</button>
                            </div>
                            <div class="mobile-class-time">${formatTime(c.startTime)} - ${formatTime(c.endTime)}</div>
                            <div class="mobile-class-title">${c.subject}</div>
                            <div class="mobile-class-loc">${c.location}</div>
                        </div>
                    `;
                });
            }
            card.innerHTML = html;
            mobileList.appendChild(card);
        });
    }

    // --- Action Listeners (Edit & Delete) ---
    function attachActionListeners() {
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                classes = classes.filter(c => c.id != id);
                saveAndRender();
            });
        });

        document.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const classToEdit = classes.find(c => c.id == id);

                if (classToEdit) {
                    editingClassId = id;
                    classModalTitle.textContent = "Edit Entry";

                    document.getElementById('subjectName').value = classToEdit.subject;
                    document.getElementById('locationName').value = classToEdit.location;
                    document.getElementById('classDay').value = classToEdit.day;
                    document.getElementById('startTime').value = classToEdit.startTime;
                    document.getElementById('endTime').value = classToEdit.endTime;

                    classModalOverlay.classList.remove('hidden');
                }
            });
        });
    }

    // --- Modal Controls (Add/Edit Form) ---
    function resetClassForm() {
        classForm.reset();
        editingClassId = null;
        classModalTitle.textContent = "Add New Entry";
        classModalOverlay.classList.add('hidden');
    }

    document.getElementById('addBtn').addEventListener('click', () => {
        resetClassForm();
        classModalOverlay.classList.remove('hidden');
    });

    document.getElementById('cancelBtn').addEventListener('click', resetClassForm);

    classForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const subject = document.getElementById('subjectName').value;
        const location = document.getElementById('locationName').value;
        const day = document.getElementById('classDay').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;

        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
            alert("End time must be after start time!");
            return;
        }

        if (editingClassId) {
            classes = classes.map(c => {
                if (c.id == editingClassId) {
                    return { ...c, subject, location, day, startTime, endTime };
                }
                return c;
            });
        } else {
            classes.push({ id: Date.now(), subject, location, day, startTime, endTime });
        }

        saveAndRender();
        resetClassForm();
    });

    // Initialize Layout
    saveAndRender();
});