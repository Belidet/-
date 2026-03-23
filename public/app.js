// API Configuration - Works for both local and Vercel
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

// Current user state
let currentUser = null;

// Helper function to make API calls
async function apiCall(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Something went wrong');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Login handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Check if already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser && window.location.pathname.includes('dashboard.html')) {
        currentUser = JSON.parse(savedUser);
        initDashboard();
    } else if (savedUser && !window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'dashboard.html';
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const errorDiv = document.getElementById('loginError');
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'በመግባት ላይ...';
    
    try {
        const result = await apiCall('/login', { username, password });
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        window.location.href = 'dashboard.html';
    } catch (error) {
        errorDiv.textContent = error.message || 'ስህተት ተከስቷል';
    }
}

// Dashboard initialization
async function initDashboard() {
    // Display user info
    const roleText = getRoleName(currentUser.role);
    document.getElementById('userNameDisplay').innerHTML = `
        <div class="user-name">${escapeHtml(currentUser.name)}</div>
        <div class="user-role">${roleText}</div>
    `;
    
    // Set current date
    const today = new Date();
    document.getElementById('currentDate').textContent = today.toLocaleDateString('am-ET', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Show/hide admin features
    if (currentUser.role === 'first_admin' || currentUser.canViewAllTasks) {
        document.getElementById('usersNavBtn').style.display = 'flex';
        document.getElementById('reportNavBtn').style.display = 'flex';
    }
    
    // Navigation setup
    setupNavigation();
    
    // Load default view (tasks)
    loadTasksView();
}

function getRoleName(role) {
    switch(role) {
        case 'first_admin': return 'ዋና አስተዳዳሪ';
        case 'admin': return 'አስተዳዳሪ';
        default: return 'ተጠቃሚ';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.dataset.view;
            switch(view) {
                case 'tasks':
                    loadTasksView();
                    document.getElementById('pageTitle').textContent = 'የዕለት ተግባራት';
                    break;
                case 'calendar':
                    loadCalendarView();
                    document.getElementById('pageTitle').textContent = 'የጉባኤ መርሃ ግብር';
                    break;
                case 'users':
                    loadUsersView();
                    document.getElementById('pageTitle').textContent = 'ተጠቃሚዎች';
                    break;
                case 'report':
                    loadReportView();
                    document.getElementById('pageTitle').textContent = 'ዕለታዊ ሪፖርት';
                    break;
            }
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

// Tasks View
async function loadTasksView() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div class="loading">በመጫን ላይ...</div>';
    
    try {
        const result = await apiCall('/tasks', { userId: currentUser.id });
        const tasks = result.tasks;
        const today = new Date().toISOString().split('T')[0];
        
        // Get attendance schedule
        const scheduleRes = await fetch(`${API_BASE}/schedule`);
        const scheduleData = await scheduleRes.json();
        const isAttendanceDay = scheduleData.schedule.some(s => s.date === today);
        
        let tasksHtml = `
            <div class="tasks-container">
                <h2>የዛሬ ተግባራት - ${new Date().toLocaleDateString('am-ET')}</h2>
        `;
        
        // Bible Reading Task
        const bibleTask = tasks.find(t => t.taskType === 'bible' && t.date === today);
        tasksHtml += `
            <div class="task-card ${bibleTask?.completed ? 'completed' : ''}">
                <h3>📖 የመጽሐፍ ቅዱስ ንባብ</h3>
                <p>የቅዱስ መጽሐፍ ንባብ የዕለት ተግባር</p>
                <div class="task-status">
                    ${bibleTask?.completed ? 
                        '<span class="completed-badge">✅ ተጠናቋል</span>' :
                        `<button onclick="completeTask('bible', '${today}')" class="complete-btn">አጠናቅቄአለሁ</button>`
                    }
                </div>
            </div>
        `;
        
        // Book Reading Task
        const bookTask = tasks.find(t => t.taskType === 'book' && t.date === today);
        tasksHtml += `
            <div class="task-card ${bookTask?.completed ? 'completed' : ''}">
                <h3>📚 የመጽሐፍ ንባብ</h3>
                <p>የመጽሐፍ ንባብ የዕለት ተግባር</p>
                <div class="task-status">
                    ${bookTask?.completed ? 
                        '<span class="completed-badge">✅ ተጠናቋል</span>' :
                        `<button onclick="completeTask('book', '${today}')" class="complete-btn">አጠናቅቄአለሁ</button>`
                    }
                </div>
            </div>
        `;
        
        // Attendance Task (only on scheduled days)
        if (isAttendanceDay) {
            const attendanceTask = tasks.find(t => t.taskType === 'attendance' && t.date === today);
            tasksHtml += `
                <div class="task-card ${attendanceTask?.completed ? 'completed' : ''}">
                    <h3>⛪ የጉባኤ አቴንዳንስ</h3>
                    <p>በቤተ ክርስቲያን መገኘት</p>
                    <div class="task-status">
                        ${attendanceTask?.completed ? 
                            '<span class="completed-badge">✅ ተጠናቋል</span>' :
                            `<button onclick="completeTask('attendance', '${today}')" class="complete-btn">ተገኝቻለሁ</button>`
                        }
                    </div>
                </div>
            `;
        }
        
        tasksHtml += '</div>';
        contentArea.innerHTML = tasksHtml;
        
    } catch (error) {
        contentArea.innerHTML = `<div class="error">ስህተት: ${error.message}</div>`;
    }
}

// Complete task function (global)
window.completeTask = async function(taskType, date) {
    try {
        await apiCall('/tasks/complete', {
            taskType,
            date,
            completed: true,
            userId: currentUser.id
        });
        loadTasksView(); // Reload the view
    } catch (error) {
        alert('ስህተት: ' + error.message);
    }
};

// Calendar View
async function loadCalendarView() {
    const contentArea = document.getElementById('contentArea');
    
    try {
        const scheduleRes = await fetch(`${API_BASE}/schedule`);
        const scheduleData = await scheduleRes.json();
        const attendanceDays = scheduleData.schedule;
        
        const today = new Date();
        let currentMonth = today.getMonth();
        let currentYear = today.getFullYear();
        
        function renderCalendar(month, year) {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay();
            
            let calendarHtml = `
                <div class="calendar-container">
                    <div class="calendar-header">
                        <button class="calendar-nav" onclick="window.prevMonth()">◀</button>
                        <h2>${new Date(year, month).toLocaleDateString('am-ET', { month: 'long', year: 'numeric' })}</h2>
                        <button class="calendar-nav" onclick="window.nextMonth()">▶</button>
                    </div>
                    <div class="calendar-grid">
                        <div class="calendar-day-header">እሑ</div>
                        <div class="calendar-day-header">ሰኞ</div>
                        <div class="calendar-day-header">ማክሰ</div>
                        <div class="calendar-day-header">ረቡዕ</div>
                        <div class="calendar-day-header">ሐሙስ</div>
                        <div class="calendar-day-header">አርብ</div>
                        <div class="calendar-day-header">ቅዳሜ</div>
            `;
            
            // Empty cells for days before month starts
            for (let i = 0; i < startDayOfWeek; i++) {
                calendarHtml += `<div class="calendar-day empty"></div>`;
            }
            
            // Fill in the days
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isAttendanceDay = attendanceDays.some(d => d.date === dateStr);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                
                calendarHtml += `
                    <div class="calendar-day ${isAttendanceDay ? 'attendance-day' : ''} ${isToday ? 'today' : ''}">
                        ${day}
                        ${isAttendanceDay ? '<div class="attendance-icon">⛪</div>' : ''}
                    </div>
                `;
            }
            
            calendarHtml += `</div></div>`;
            return calendarHtml;
        }
        
        contentArea.innerHTML = renderCalendar(currentMonth, currentYear);
        
        window.prevMonth = function() {
            if (currentMonth === 0) {
                currentMonth = 11;
                currentYear--;
            } else {
                currentMonth--;
            }
            contentArea.innerHTML = renderCalendar(currentMonth, currentYear);
        };
        
        window.nextMonth = function() {
            if (currentMonth === 11) {
                currentMonth = 0;
                currentYear++;
            } else {
                currentMonth++;
            }
            contentArea.innerHTML = renderCalendar(currentMonth, currentYear);
        };
        
    } catch (error) {
        contentArea.innerHTML = `<div class="error">ስህተት: ${error.message}</div>`;
    }
}

// Users View (Admin only)
async function loadUsersView() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div class="loading">በመጫን ላይ...</div>';
    
    try {
        const usersResult = await apiCall('/users', { userId: currentUser.id });
        const users = usersResult.users;
        
        let usersHtml = `
            <button class="create-user-btn" onclick="window.showUserModal()">+ አዲስ ተጠቃሚ ይፍጠሩ</button>
            <table class="users-table">
                <thead>
                    <tr>
                        <th>ሙሉ ስም</th>
                        <th>የተጠቃሚ ስም</th>
                        <th>ሚና</th>
                        <th>ተፈጠረበት ቀን</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        users.forEach(user => {
            usersHtml += `
                <tr>
                    <td>${escapeHtml(user.name)}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${getRoleName(user.role)}</td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
            `;
        });
        
        usersHtml += `</tbody></table>`;
        contentArea.innerHTML = usersHtml;
        
    } catch (error) {
        contentArea.innerHTML = `<div class="error">ስህተት: ${error.message}</div>`;
    }
}

window.showUserModal = function() {
    const modal = document.getElementById('userModal');
    modal.style.display = 'flex';
    
    const roleSelect = document.getElementById('userRole');
    const adminAuthOptions = document.getElementById('adminAuthOptions');
    
    roleSelect.onchange = function() {
        adminAuthOptions.style.display = this.value === 'admin' ? 'block' : 'none';
    };
    
    document.getElementById('createUserForm').onsubmit = async function(e) {
        e.preventDefault();
        
        const userData = {
            name: document.getElementById('userName').value,
            username: document.getElementById('userUsername').value,
            password: document.getElementById('userPassword').value,
            role: document.getElementById('userRole').value,
            canCreateAdmins: document.getElementById('fullAuthority')?.checked || false
        };
        
        try {
            await apiCall('/users/create', userData);
            modal.style.display = 'none';
            loadUsersView();
            document.getElementById('createUserForm').reset();
        } catch (error) {
            alert('ስህተት: ' + error.message);
        }
    };
};

// Close modal when clicking X
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('close')) {
        document.getElementById('userModal').style.display = 'none';
    }
});

// Report View
async function loadReportView() {
    const contentArea = document.getElementById('contentArea');
    const today = new Date().toISOString().split('T')[0];
    
    contentArea.innerHTML = `
        <div class="report-filters">
            <label>ቀን ይምረጡ:</label>
            <input type="date" id="reportDate" value="${today}">
            <button onclick="window.loadReport()" class="report-btn">ሪፖርት ይመልከቱ</button>
        </div>
        <div id="reportContent"></div>
    `;
    
    window.loadReport = async function() {
        const date = document.getElementById('reportDate').value;
        const reportContent = document.getElementById('reportContent');
        reportContent.innerHTML = '<div class="loading">በመጫን ላይ...</div>';
        
        try {
            const result = await apiCall('/report', { date });
            const report = result.report;
            
            if (report.length === 0) {
                reportContent.innerHTML = '<div class="error">ለዚህ ቀን ምንም ተጠቃሚዎች የሉም</div>';
                return;
            }
            
            let reportHtml = `
                <h3>የ${new Date(date).toLocaleDateString('am-ET')} ዕለታዊ ሪፖርት</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>ተጠቃሚ</th>
                            <th>የመጽሐፍ ቅዱስ ንባብ</th>
                            <th>የመጽሐፍ ንባብ</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            report.forEach(item => {
                reportHtml += `
                    <tr>
                        <td>${escapeHtml(item.userName)}</td>
                        <td class="${item.bibleReading ? 'completed-yes' : 'completed-no'}">
                            ${item.bibleReading ? '✅ ተጠናቋል' : '❌ አልተጠናቀቀም'}
                        </td>
                        <td class="${item.bookReading ? 'completed-yes' : 'completed-no'}">
                            ${item.bookReading ? '✅ ተጠናቋል' : '❌ አልተጠናቀቀም'}
                        </td>
                    </tr>
                `;
            });
            
            reportHtml += `</tbody></table>`;
            reportContent.innerHTML = reportHtml;
            
        } catch (error) {
            reportContent.innerHTML = `<div class="error">ስህተት: ${error.message}</div>`;
        }
    };
    
    // Load initial report
    window.loadReport();
}
