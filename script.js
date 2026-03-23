// Data Structure
let users = [];
let currentUser = null;
let meetingDate = '';
let tasksCompletion = {};

// Task Definitions
const TASKS = [
    { id: 'bible', amharic: 'የመጽሐፍ ቅዱስ ንባብ', english: 'Bible Reading', alwaysVisible: true },
    { id: 'book', amharic: 'የመጽሐፍ ንባብ', english: 'Book Reading', alwaysVisible: true },
    { id: 'meeting', amharic: 'የጉባኤ ተሳትፎ', english: 'Meeting Participation', alwaysVisible: false }
];

// Initialize Application
function init() {
    loadData();
    setupEventListeners();
    
    if (users.length === 0) {
        showFirstAdminSetup();
    } else {
        showLogin();
    }
}

// Load data from localStorage
function loadData() {
    const storedUsers = localStorage.getItem('amekro_users');
    if (storedUsers) {
        users = JSON.parse(storedUsers);
    } else {
        users = [];
    }
    
    const storedMeetingDate = localStorage.getItem('amekro_meeting_date');
    if (storedMeetingDate) {
        meetingDate = storedMeetingDate;
    } else {
        meetingDate = new Date().toISOString().split('T')[0];
    }
    
    const storedTasks = localStorage.getItem('amekro_tasks_completion');
    if (storedTasks) {
        tasksCompletion = JSON.parse(storedTasks);
    } else {
        tasksCompletion = {};
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('amekro_users', JSON.stringify(users));
    localStorage.setItem('amekro_meeting_date', meetingDate);
    localStorage.setItem('amekro_tasks_completion', JSON.stringify(tasksCompletion));
}

// Show first admin setup
function showFirstAdminSetup() {
    const loginSection = document.getElementById('loginSection');
    loginSection.innerHTML = `
        <div class="icon-border">
            <svg class="icon-saint" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="35" stroke="#C9A87C" stroke-width="2" fill="none"/>
                <path d="M40 20 L40 60 M25 35 L55 35 M30 45 L50 45" stroke="#C9A87C" stroke-width="2"/>
                <circle cx="40" cy="30" r="5" stroke="#C9A87C" stroke-width="2" fill="none"/>
            </svg>
        </div>
        <h2>የመጀመሪያ አስተዳዳሪ ምዝገባ / First Admin Setup</h2>
        <form id="firstAdminForm">
            <div class="form-group">
                <label>ስም / Username</label>
                <input type="text" id="adminUsername" required>
            </div>
            <div class="form-group">
                <label>የይለፍ ቃል / Password</label>
                <input type="password" id="adminPassword" required>
            </div>
            <button type="submit" class="btn-primary">ፍጠር / Create</button>
        </form>
    `;
    
    document.getElementById('firstAdminForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        if (username && password) {
            users.push({
                id: Date.now().toString(),
                username: username,
                password: password,
                role: 'admin',
                createdAt: new Date().toISOString()
            });
            saveData();
            showLogin();
        }
    });
}

// Show login form
function showLogin() {
    const loginSection = document.getElementById('loginSection');
    loginSection.style.display = 'block';
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('userSection').style.display = 'none';
    
    loginSection.innerHTML = `
        <div class="icon-border">
            <svg class="icon-saint" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="35" stroke="#C9A87C" stroke-width="2" fill="none"/>
                <path d="M40 20 L40 60 M25 35 L55 35 M30 45 L50 45" stroke="#C9A87C" stroke-width="2"/>
                <circle cx="40" cy="30" r="5" stroke="#C9A87C" stroke-width="2" fill="none"/>
            </svg>
        </div>
        <h2>ግባ / Login</h2>
        <form id="loginForm">
            <div class="form-group">
                <label>ስም / Username</label>
                <input type="text" id="loginUsername" required>
            </div>
            <div class="form-group">
                <label>የይለፍ ቃል / Password</label>
                <input type="password" id="loginPassword" required>
            </div>
            <button type="submit" class="btn-primary">ግባ / Login</button>
        </form>
        <div id="loginError" class="error-message"></div>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// Handle login
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        if (user.role === 'admin') {
            showAdminDashboard();
        } else {
            showUserDashboard();
        }
    } else {
        document.getElementById('loginError').textContent = 'ስህተት: የተሳሳተ ስም ወይም የይለፍ ቃል / Invalid username or password';
    }
}

// Show admin dashboard
function showAdminDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'block';
    document.getElementById('userSection').style.display = 'none';
    
    document.getElementById('meetingDatePicker').value = meetingDate;
    refreshAdminView();
    setupAdminListeners();
}

// Refresh admin view
function refreshAdminView() {
    refreshUsersTable();
    refreshUsersTasksView();
}

// Refresh users table
function refreshUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = user.username;
        row.insertCell(1).textContent = user.role === 'admin' ? 'Admin' : 'User';
        
        const actionsCell = row.insertCell(2);
        
        if (user.role !== 'admin' || user.id !== currentUser.id) {
            const changePassBtn = document.createElement('button');
            changePassBtn.textContent = 'Change Pass';
            changePassBtn.className = 'btn-warning';
            changePassBtn.onclick = () => changeUserPassword(user.id);
            actionsCell.appendChild(changePassBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'btn-danger';
            deleteBtn.onclick = () => deleteUser(user.id);
            actionsCell.appendChild(deleteBtn);
        }
        
        if (user.role !== 'admin') {
            const makeAdminBtn = document.createElement('button');
            makeAdminBtn.textContent = 'Make Admin';
            makeAdminBtn.className = 'btn-success';
            makeAdminBtn.style.marginLeft = '5px';
            makeAdminBtn.onclick = () => makeAdmin(user.id);
            actionsCell.appendChild(makeAdminBtn);
        }
    });
}

// Refresh users tasks view
function refreshUsersTasksView() {
    const container = document.getElementById('usersTasksView');
    container.innerHTML = '';
    
    const standardUsers = users.filter(u => u.role === 'user');
    
    standardUsers.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-tasks-card';
        
        const title = document.createElement('h4');
        title.textContent = user.username;
        card.appendChild(title);
        
        const tasksToShow = getTasksForUser(user);
        tasksToShow.forEach(task => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'user-task-row';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'user-task-checkbox';
            const taskKey = `${user.id}_${task.id}_${getCurrentDate()}`;
            checkbox.checked = tasksCompletion[taskKey] || false;
            checkbox.onchange = () => {
                tasksCompletion[taskKey] = checkbox.checked;
                saveData();
            };
            
            const label = document.createElement('label');
            label.textContent = `${task.amharic} (${task.english})`;
            
            taskDiv.appendChild(checkbox);
            taskDiv.appendChild(label);
            card.appendChild(taskDiv);
        });
        
        container.appendChild(card);
    });
}

// Get tasks for user based on date
function getTasksForUser(user) {
    const tasks = [];
    const currentDate = getCurrentDate();
    
    TASKS.forEach(task => {
        if (task.alwaysVisible) {
            tasks.push(task);
        } else if (currentDate === meetingDate) {
            tasks.push(task);
        }
    });
    
    return tasks;
}

// Get current date
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

// Setup admin listeners
function setupAdminListeners() {
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('createUserBtn').onclick = createUser;
    document.getElementById('meetingDatePicker').onchange = (e) => {
        meetingDate = e.target.value;
        saveData();
        refreshAdminView();
    };
}

// Create new user
function createUser() {
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newUserRole').value;
    
    if (username && password) {
        if (users.find(u => u.username === username)) {
            alert('Username already exists!');
            return;
        }
        
        users.push({
            id: Date.now().toString(),
            username: username,
            password: password,
            role: role,
            createdAt: new Date().toISOString()
        });
        saveData();
        refreshAdminView();
        
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
    } else {
        alert('Please fill in both username and password');
    }
}

// Change user password
function changeUserPassword(userId) {
    const newPassword = prompt('Enter new password:');
    if (newPassword) {
        const user = users.find(u => u.id === userId);
        if (user) {
            user.password = newPassword;
            saveData();
            refreshAdminView();
            alert('Password changed successfully');
        }
    }
}

// Delete user
function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        users = users.filter(u => u.id !== userId);
        saveData();
        refreshAdminView();
    }
}

// Make user admin
function makeAdmin(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.role = 'admin';
        saveData();
        refreshAdminView();
    }
}

// Show user dashboard
function showUserDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('userSection').style.display = 'block';
    
    document.getElementById('currentUsername').textContent = currentUser.username;
    document.getElementById('currentDateDisplay').textContent = `ዛሬ / Today: ${getCurrentDate()}`;
    
    refreshUserTasks();
    setupUserListeners();
}

// Refresh user tasks
function refreshUserTasks() {
    const container = document.getElementById('userTasksList');
    container.innerHTML = '';
    
    const tasksToShow = getTasksForUser(currentUser);
    const currentDate = getCurrentDate();
    
    tasksToShow.forEach(task => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        const taskKey = `${currentUser.id}_${task.id}_${currentDate}`;
        checkbox.checked = tasksCompletion[taskKey] || false;
        checkbox.onchange = () => {
            tasksCompletion[taskKey] = checkbox.checked;
            saveData();
            if (checkbox.checked) {
                taskDiv.classList.add('completed');
            } else {
                taskDiv.classList.remove('completed');
            }
        };
        
        const label = document.createElement('label');
        label.className = 'task-label';
        label.innerHTML = `<span class="task-amharic">${task.amharic}</span><span class="task-english">(${task.english})</span>`;
        
        if (tasksCompletion[taskKey]) {
            taskDiv.classList.add('completed');
        }
        
        taskDiv.appendChild(checkbox);
        taskDiv.appendChild(label);
        container.appendChild(taskDiv);
    });
}

// Setup user listeners
function setupUserListeners() {
    document.getElementById('userLogoutBtn').onclick = logout;
    document.getElementById('changePasswordBtn').onclick = changeOwnPassword;
    document.getElementById('deleteOwnAccountBtn').onclick = deleteOwnAccount;
}

// Change own password
function changeOwnPassword() {
    const oldPassword = document.getElementById('changePasswordOld').value;
    const newPassword = document.getElementById('changePasswordNew').value;
    
    if (currentUser.password === oldPassword) {
        if (newPassword) {
            currentUser.password = newPassword;
            const userIndex = users.findIndex(u => u.id === currentUser.id);
            if (userIndex !== -1) {
                users[userIndex] = currentUser;
                saveData();
                alert('Password changed successfully!');
                document.getElementById('changePasswordOld').value = '';
                document.getElementById('changePasswordNew').value = '';
            }
        } else {
            alert('Please enter a new password');
        }
    } else {
        alert('Old password is incorrect');
    }
}

// Delete own account
function deleteOwnAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        users = users.filter(u => u.id !== currentUser.id);
        saveData();
        logout();
    }
}

// Logout
function logout() {
    currentUser = null;
    showLogin();
}

// Setup event listeners
function setupEventListeners() {
    // Initial setup is handled in init
}

// Start the application
init();