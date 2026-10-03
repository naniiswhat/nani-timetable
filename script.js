document.addEventListener('DOMContentLoaded', () => {
    // --- State & Setup ---
    let classes = JSON.parse(localStorage.getItem('geoTableData')) || [];
    let editingClassId = null; // Tracks if we are editing vs adding

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const DAY_START_MINS = 8 * 60;
    const TOTAL_DAY_MINS = 10 * 60;

    // --- DOM Elements ---
    const gridBody = document.getElementById('gridBody');
    const mobileList = document.getElementById('mobileList');

    // Class Modal Elements
    const addBtn = document.getElementById('addBtn');
    const classModalOverlay = document.getElementById('modalOverlay');
    const cancelBtn = document.getElementById('cancelBtn');
    const classForm = document.getElementById('classForm');
    const classModalTitle = document.getElementById('classModalTitle');

    // Theme & Settings Elements
    const themeSettingsBtn = document.getElementById('themeSettingsBtn');
    const themeModalOverlay = document.getElementById('themeModalOverlay');
    const closeThemeBtn = document.getElementById('closeThemeBtn');
    const themeForm = document.getElementById('themeForm');
    const btnGeoPreset = document.getElementById('btnGeoPreset');
    const btnMarchPreset = document.getElementById('btnMarchPreset');

    // --- Settings / Theme Logic ---
    let currentThemeMode = localStorage.getItem('themeMode') || 'geo';
    let customColors = JSON.parse(localStorage.getItem('customColors')) || {
        bg: '#181411', card: '#211b16', accent: '#db9d35', border: '#2e2620', text: '#f3ece2'
    };
    let breakSettings = JSON.parse(localStorage.getItem('breakSettings')) || {
        start: '13:00', end: '13:50'
    };

    function applyTheme() {
        const root = document.documentElement;
        root.style = ''; // Reset custom inline styles

        if (currentThemeMode === 'geo') {
            root.removeAttribute('data-theme');
        } else if (currentThemeMode === 'march7th') {
            root.setAttribute('data-theme', 'march7th');
        } else if (currentThemeMode === 'custom') {
            root.removeAttribute('data-theme');
            root.style.setProperty('--bg', customColors.bg);
            root.style.setProperty('--card-bg', customColors.card);
            root.style.setProperty('--accent', customColors.accent);
            root.style.setProperty('--border', customColors.border);
            root.style.setProperty('--text-main', customColors.text);
            root.style.setProperty('--day-label-bg', customColors.card);
            root.style.setProperty('--header-bg', customColors.bg);
            root.style.setProperty('--text-muted', customColors.text + '99');
            root.style.setProperty('--break-bg', `repeating-linear-gradient(45deg, transparent, transparent 10px, ${customColors.text}1a 10px, ${customColors.text}1a 20px)`);
        }
    }

    applyTheme(); // Run on load

    // Open Settings Modal
    themeSettingsBtn.addEventListener('click', () => {
        document.getElementById('breakStart').value = breakSettings.start;
        document.getElementById('breakEnd').value = breakSettings.end;

        document.getElementById('customBg').value = customColors.bg;
        document.getElementById('customCard').value = customColors.card;
        document.getElementById('customAccent').value = customColors.accent;
        document.getElementById('customBorder').value = customColors.border;
        document.getElementById('customText').value = customColors.text;

        themeModalOverlay.classList.remove('hidden');
    });

    closeThemeBtn.addEventListener('click', () => themeModalOverlay.classList.add('hidden'));

    // Save Settings
    themeForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const bStart = document.getElementById('breakStart').value;
        const bEnd = document.getElementById('breakEnd').value;

        if (timeToMinutes(bEnd) <= timeToMinutes(bStart)) {
            alert("Break end time must be after start time!");
            return;
        }

        breakSettings = { start: bStart, end: bEnd };
        customColors = {
            bg: document.getElementById('customBg').value,
            card: document.getElementById('customCard').value,
            accent: document.getElementById('customAccent').value,
            border: document.getElementById('customBorder').value,
            text: document.getElementById('customText').value
        };

        currentThemeMode = 'custom';
        localStorage.setItem('themeMode', currentThemeMode);
        localStorage.setItem('customColors', JSON.stringify(customColors));
        localStorage.setItem('breakSettings', JSON.stringify(breakSettings));

        applyTheme();
        saveAndRender(); // Re-render to update break graphic
        themeModalOverlay.classList.add('hidden');
    });

    // Theme Presets
    btnGeoPreset.addEventListener('click', () => {
        currentThemeMode = 'geo';
        localStorage.setItem('themeMode', currentThemeMode);
        applyTheme();
    });

    btnMarchPreset.addEventListener('click', () => {
        currentThemeMode = 'march7th';
        localStorage.setItem('themeMode', currentThemeMode);
        applyTheme();
    });

    // --- Core Timetable Logic ---
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

        // Calculate dynamic break column position
        const bStartMins = timeToMinutes(breakSettings.start);
        const bEndMins = timeToMinutes(breakSettings.end);
        let bLeft = (bStartMins - DAY_START_MINS) / TOTAL_DAY_MINS;
        let bWidth = (bEndMins - bStartMins) / TOTAL_DAY_MINS;

        if (bLeft < 0) bLeft = 0;
        if (bLeft + bWidth > 1) bWidth = 1 - bLeft;

        breakCol.style.left = `calc(100px + (100% - 100px) * ${bLeft})`;
        breakCol.style.width = `calc((100% - 100px) * ${bWidth})`;

        // Preserve break column, wipe rows
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
        // Delete
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                classes = classes.filter(c => c.id != id);
                saveAndRender();
            });
        });

        // Edit
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

    addBtn.addEventListener('click', () => {
        resetClassForm();
        classModalOverlay.classList.remove('hidden');
    });

    cancelBtn.addEventListener('click', resetClassForm);

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
            // Update existing class
            classes = classes.map(c => {
                if (c.id == editingClassId) {
                    return { ...c, subject, location, day, startTime, endTime };
                }
                return c;
            });
        } else {
            // Create new class
            classes.push({
                id: Date.now(),
                subject, location, day, startTime, endTime
            });
        }

        saveAndRender();
        resetClassForm();
    });

    // Initial Start
    saveAndRender();
});