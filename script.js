document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Toggling Logic ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    // Check if user has a saved theme, default to 'geo' if not
    let currentTheme = localStorage.getItem('appTheme') || 'geo';

    // Apply the saved theme on load
    if (currentTheme === 'march7th') {
        document.documentElement.setAttribute('data-theme', 'march7th');
    }

    themeToggleBtn.addEventListener('click', () => {
        if (currentTheme === 'geo') {
            document.documentElement.setAttribute('data-theme', 'march7th');
            currentTheme = 'march7th';
        } else {
            document.documentElement.removeAttribute('data-theme');
            currentTheme = 'geo';
        }
        localStorage.setItem('appTheme', currentTheme);
    });
    // ----------------------------

    const gridBody = document.getElementById('gridBody');
    const addBtn = document.getElementById('addBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const cancelBtn = document.getElementById('cancelBtn');
    const classForm = document.getElementById('classForm');

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const DAY_START_MINS = 8 * 60;
    const TOTAL_DAY_MINS = 10 * 60;

    let classes = JSON.parse(localStorage.getItem('geoTableData')) || [];

    function saveAndRender() {
        localStorage.setItem('geoTableData', JSON.stringify(classes));
        renderTable();
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

    function renderTable() {
        const breakCol = gridBody.querySelector('.break-column').outerHTML;
        gridBody.innerHTML = breakCol;

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
                    <button class="delete-btn" data-id="${c.id}">&times;</button>
                    <div class="class-subject">${c.subject}</div>
                    <div class="class-meta">${formatTime(c.startTime)} - ${formatTime(c.endTime)}</div>
                    <div class="class-meta">${c.location}</div>
                `;
                track.appendChild(block);
            });

            row.appendChild(track);
            gridBody.appendChild(row);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                classes = classes.filter(c => c.id != id);
                saveAndRender();
            });
        });
    }

    addBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        classForm.reset();
    });

    classForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const newClass = {
            id: Date.now(),
            subject: document.getElementById('subjectName').value,
            location: document.getElementById('locationName').value,
            day: document.getElementById('classDay').value,
            startTime: document.getElementById('startTime').value,
            endTime: document.getElementById('endTime').value
        };

        if (timeToMinutes(newClass.endTime) <= timeToMinutes(newClass.startTime)) {
            alert("End time must be after start time!");
            return;
        }

        classes.push(newClass);
        saveAndRender();

        modalOverlay.classList.add('hidden');
        classForm.reset();
    });

    renderTable();
});