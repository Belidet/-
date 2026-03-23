const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

// Load environment variables
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    // Use cached connection if available
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db();

    // Cache the connection
    cachedClient = client;
    cachedDb = db;

    return { client, db };
}

// ==================== DATABASE COLLECTIONS ====================
const getCollections = async () => {
    const { db } = await connectToDatabase();
    return {
        users: db.collection('users'),
        tasks: db.collection('tasks'),
        attendanceSchedule: db.collection('attendanceSchedule')
    };
};

// ==================== HELPER FUNCTIONS ====================

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 8);
}

async function findUserByUsername(usersCollection, username) {
    return await usersCollection.findOne({ username });
}

// ==================== INITIALIZATION ====================

async function initializeData() {
    try {
        const { users, attendanceSchedule } = await getCollections();
        
        // Check if first admin exists
        const adminCount = await users.countDocuments({ role: 'first_admin' });
        
        if (adminCount === 0) {
            // Create first admin
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await users.insertOne({
                id: 'admin_1',
                username: 'spiritual_father',
                password: hashedPassword,
                name: 'አባ ገብረ ማርያም',
                role: 'first_admin',
                canCreateAdmins: true,
                canViewAllTasks: true,
                createdAt: new Date().toISOString()
            });
            console.log('✓ First admin created. Username: spiritual_father, Password: admin123');
        }
        
        // Check if attendance schedule exists
        const scheduleCount = await attendanceSchedule.countDocuments();
        
        if (scheduleCount === 0) {
            // Initialize attendance schedule (Sundays and Wednesdays for next 60 days)
            const today = new Date();
            const schedule = [];
            
            for (let i = 0; i < 60; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                // Sunday (0) or Wednesday (3)
                if (date.getDay() === 0 || date.getDay() === 3) {
                    schedule.push({
                        id: generateId(),
                        date: date.toISOString().split('T')[0],
                        taskType: 'attendance',
                        description: 'የጉባኤ ቀን',
                        createdAt: new Date().toISOString()
                    });
                }
            }
            
            if (schedule.length > 0) {
                await attendanceSchedule.insertMany(schedule);
                console.log(`✓ Attendance schedule initialized with ${schedule.length} dates`);
            }
        }
        
        // Create indexes for better performance
        await users.createIndex({ username: 1 }, { unique: true });
        await tasks.createIndex({ userId: 1, taskType: 1, date: 1 });
        await attendanceSchedule.createIndex({ date: 1 });
        
        console.log('✓ Database indexes created');
        
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

// ==================== AUTHENTICATION MIDDLEWARE ====================

async function authenticate(req, res, next) {
    const { userId, username } = req.body;
    
    if (!userId && !username) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const { users } = await getCollections();
        let user;
        
        if (userId) {
            user = await users.findOne({ id: userId });
        } else if (username) {
            user = await users.findOne({ username });
        }
        
        if (user) {
            req.user = user;
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized. Please log in again.' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

// ==================== API ROUTES ====================

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const { users, tasks, attendanceSchedule } = await getCollections();
        const userCount = await users.countDocuments();
        const taskCount = await tasks.countDocuments();
        const scheduleCount = await attendanceSchedule.countDocuments();
        
        res.json({ 
            status: 'OK', 
            database: 'connected',
            users: userCount,
            tasks: taskCount,
            schedule: scheduleCount,
            mongodb_uri: MONGODB_URI ? 'configured' : 'missing'
        });
    } catch (error) {
        res.status(500).json({ status: 'Error', error: error.message });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        const { users } = await getCollections();
        const user = await users.findOne({ username });
        
        if (!user) {
            return res.status(401).json({ error: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
        }
        
        if (bcrypt.compareSync(password, user.password)) {
            // Don't send password back
            const { password: _, ...userWithoutPassword } = user;
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    canCreateAdmins: user.canCreateAdmins || false,
                    canViewAllTasks: user.canViewAllTasks || false
                }
            });
        } else {
            res.status(401).json({ error: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Get all users (admin only)
app.post('/api/users', authenticate, async (req, res) => {
    if (req.user.role !== 'first_admin' && !req.user.canViewAllTasks) {
        return res.status(403).json({ error: 'እርስዎ ይህን ማየት አይችሉም' });
    }
    
    try {
        const { users } = await getCollections();
        const allUsers = await users.find({}).toArray();
        
        const safeUsers = allUsers.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
            canCreateAdmins: u.canCreateAdmins || false,
            createdAt: u.createdAt
        }));
        
        res.json({ users: safeUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create user (first admin only)
app.post('/api/users/create', authenticate, async (req, res) => {
    const { name, username, password, role, canCreateAdmins } = req.body;
    
    // Only first admin can create users
    if (req.user.role !== 'first_admin') {
        return res.status(403).json({ error: 'አዲስ ተጠቃሚ የመፍጠር ፈቃድ የለዎትም' });
    }
    
    // Validate input
    if (!name || !username || !password) {
        return res.status(400).json({ error: 'ሁሉም መረጃዎች መሙላት አለባቸው' });
    }
    
    try {
        const { users } = await getCollections();
        
        // Check if username exists
        const existingUser = await users.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'ይህ የተጠቃሚ ስም አስቀድሞ ተመዝግቧል' });
        }
        
        const newUser = {
            id: generateId(),
            username,
            password: bcrypt.hashSync(password, 10),
            name,
            role: role || 'standard',
            canCreateAdmins: role === 'admin' ? (canCreateAdmins === true || canCreateAdmins === 'true') : false,
            canViewAllTasks: role === 'admin' ? (canCreateAdmins === true || canCreateAdmins === 'true') : false,
            createdAt: new Date().toISOString()
        };
        
        await users.insertOne(newUser);
        
        res.json({ 
            success: true, 
            user: { 
                id: newUser.id, 
                name, 
                username, 
                role: newUser.role 
            } 
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get tasks for a user
app.post('/api/tasks', authenticate, async (req, res) => {
    try {
        const { tasks } = await getCollections();
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let userTasks;
        if (userRole === 'first_admin' || req.user.canViewAllTasks) {
            userTasks = await tasks.find({}).toArray();
        } else {
            userTasks = await tasks.find({ userId }).toArray();
        }
        
        res.json({ tasks: userTasks });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Create or update task completion
app.post('/api/tasks/complete', authenticate, async (req, res) => {
    const { taskType, date, completed } = req.body;
    const userId = req.user.id;
    
    if (!taskType || !date) {
        return res.status(400).json({ error: 'Task type and date are required' });
    }
    
    try {
        const { tasks } = await getCollections();
        
        const existingTask = await tasks.findOne({
            userId,
            taskType,
            date
        });
        
        if (existingTask) {
            await tasks.updateOne(
                { _id: existingTask._id },
                { 
                    $set: { 
                        completed: completed || false,
                        completedAt: completed ? new Date().toISOString() : null
                    }
                }
            );
            
            const updatedTask = await tasks.findOne({ _id: existingTask._id });
            res.json({ success: true, task: updatedTask });
        } else {
            const newTask = {
                id: generateId(),
                userId,
                userName: req.user.name,
                taskType,
                date,
                completed: completed || false,
                completedAt: completed ? new Date().toISOString() : null,
                createdAt: new Date().toISOString()
            };
            
            await tasks.insertOne(newTask);
            res.json({ success: true, task: newTask });
        }
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Get attendance schedule
app.get('/api/schedule', async (req, res) => {
    try {
        const { attendanceSchedule } = await getCollections();
        const schedule = await attendanceSchedule.find({}).toArray();
        res.json({ schedule });
    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// Add attendance schedule date (admin only)
app.post('/api/schedule/add', authenticate, async (req, res) => {
    if (req.user.role !== 'first_admin') {
        return res.status(403).json({ error: 'የጊዜ ሰሌዳ ማከል የሚችሉት ዋና አስተዳዳሪ ብቻ ነው' });
    }
    
    const { date } = req.body;
    
    if (!date) {
        return res.status(400).json({ error: 'ቀን ያስፈልጋል' });
    }
    
    try {
        const { attendanceSchedule } = await getCollections();
        
        const existingSchedule = await attendanceSchedule.findOne({ date });
        
        if (!existingSchedule) {
            await attendanceSchedule.insertOne({
                id: generateId(),
                date,
                taskType: 'attendance',
                description: 'የጉባኤ ቀን',
                createdAt: new Date().toISOString()
            });
        }
        
        const schedule = await attendanceSchedule.find({}).toArray();
        res.json({ success: true, schedule });
    } catch (error) {
        console.error('Add schedule error:', error);
        res.status(500).json({ error: 'Failed to add schedule' });
    }
});

// Remove attendance schedule date (admin only)
app.post('/api/schedule/remove', authenticate, async (req, res) => {
    if (req.user.role !== 'first_admin') {
        return res.status(403).json({ error: 'የጊዜ ሰሌዳ ማስወገድ የሚችሉት ዋና አስተዳዳሪ ብቻ ነው' });
    }
    
    const { date } = req.body;
    
    try {
        const { attendanceSchedule } = await getCollections();
        await attendanceSchedule.deleteOne({ date });
        
        const schedule = await attendanceSchedule.find({}).toArray();
        res.json({ success: true, schedule });
    } catch (error) {
        console.error('Remove schedule error:', error);
        res.status(500).json({ error: 'Failed to remove schedule' });
    }
});

// Get completion report for a specific date
app.post('/api/report', authenticate, async (req, res) => {
    if (req.user.role !== 'first_admin' && !req.user.canViewAllTasks) {
        return res.status(403).json({ error: 'ሪፖርት ማየት አይችሉም' });
    }
    
    const { date } = req.body;
    
    try {
        const { tasks, users } = await getCollections();
        
        const dailyTasks = await tasks.find({ date }).toArray();
        const allUsers = await users.find({ role: 'standard' }).toArray();
        
        const report = allUsers.map(user => ({
            userId: user.id,
            userName: user.name,
            bibleReading: dailyTasks.some(t => t.userId === user.id && t.taskType === 'bible' && t.completed) || false,
            bookReading: dailyTasks.some(t => t.userId === user.id && t.taskType === 'book' && t.completed) || false
        }));
        
        res.json({ report, date });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Initialize data on server start
initializeData();

// Export for Vercel
module.exports = app;
