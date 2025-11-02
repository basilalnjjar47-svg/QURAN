const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors'); // 1. استدعاء المكتبة الجديدة

// --- 1. إعداد الخادم ---
const app = express();
const server = http.createServer(app);

app.use(cors()); // 2. استخدام المكتبة للسماح بالطلبات من أي مكان

const io = new Server(server, {
    cors: {
        origin: "*", // للسماح بالاتصالات من أي مكان (للتطوير)
    }
});

// --- 2. الاتصال بقاعدة البيانات ---
// !!! هام: استبدل هذا السطر بمفتاح الاتصال الخاص بك !!!
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('تم الاتصال بقاعدة بيانات MongoDB بنجاح');
        createDefaultAdminIfNeeded(); // استدعاء الدالة لإنشاء الأدمن
    })
    .catch(err => console.error('فشل الاتصال بقاعدة البيانات:', err));

// --- 3. تعريف نماذج البيانات (Mongoose Schemas) ---
// نموذج بسيط لتخزين بيانات المستخدمين

const scheduleItemSchema = new mongoose.Schema({
    day: String,
    time: String,
    teacher: String,
    plan: String
});

const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    grade: String,
    group: String, // حقل جديد لتحديد المجموعة (أ, ب, ج, ...)
    schedule: [scheduleItemSchema], // حقل جديد لتخزين جدول الطالب
    // --- إضافة جديدة: حقل لربط الطالب بالمعلم ---
    teacherId: { type: String, default: null } 
});
const User = mongoose.model('User', userSchema);

// --- دالة لإنشاء حساب المدير الافتراضي ---
async function createDefaultAdminIfNeeded() {
    try {
        // 1. البحث هل يوجد أي مستخدم بصلاحية مدير
        const adminExists = await User.findOne({ role: 'admin' });

        if (!adminExists) {
            // 2. إذا لم يوجد، قم بإنشاء واحد جديد
            const defaultAdmin = new User({
                id: 'admin', // رقم عضوية الأدمن
                name: 'المدير العام', // اسم الأدمن
                password: 'admin', // كلمة مرور الأدمن (مهم: يجب تغييرها لاحقاً)
                role: 'admin'
            });
            await defaultAdmin.save();
            console.log('*****************************************************');
            console.log('>> تم إنشاء حساب المدير الافتراضي بنجاح.');
            console.log('>> رقم العضوية: admin');
            console.log('>> كلمة المرور: admin');
            console.log('*****************************************************');
        }
    } catch (error) {
        console.error('!! حدث خطأ أثناء إنشاء حساب المدير الافتراضي:', error);
    }
}

// --- 4. إعداد Express لخدمة الملفات الثابتة ---
// لن نستخدم هذا في بيئة الإنتاج، لأن Netlify سيقوم بخدمة الملفات
// app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => {
    res.send("خادم منصة إتقان يعمل بنجاح. هذا الرابط مخصص للاتصال البرمجي فقط.");
});
app.use(express.json()); // للسماح باستقبال بيانات JSON

// --- 5. واجهات API لإدارة المستخدمين (بديل للمصفوفات المحلية) ---

// جلب كل المستخدمين
app.get('/api/users', async (req, res) => {
    const users = await User.find({});
    res.json(users);
});

// جلب المعلمين فقط (للقوائم المنسدلة)
app.get('/api/teachers', async (req, res) => {
    const teachers = await User.find({ role: 'teacher' });
    res.json(teachers);
});

// إضافة مستخدم جديد
app.post('/api/users', async (req, res) => {
    try {
        const userExists = await User.findOne({ id: req.body.id });
        if (userExists) {
            return res.status(400).json({ message: 'رقم العضوية هذا مستخدم بالفعل.' });
        }
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- واجهة جديدة لتسجيل الدخول ---
app.post('/api/login', async (req, res) => {
    const { id, password, role } = req.body;

    const user = await User.findOne({ id: id });

    if (!user) {
        return res.status(404).json({ message: 'رقم العضوية غير موجود.' });
    }

    // في تطبيق حقيقي، يجب مقارنة كلمة المرور المشفرة
    if (user.password !== password) {
        return res.status(401).json({ message: 'كلمة المرور غير صحيحة.' });
    }

    if (user.role !== role) {
        return res.status(403).json({ message: `هذا الحساب ليس من نوع '${role}'.` });
    }

    const pages = {
        student: 'student-dashboard.html',
        teacher: 'teacher-dashboard.html',
        admin: 'admin-dashboard.html'
    };
    res.json({ message: 'تم تسجيل الدخول بنجاح', user: user, redirectTo: pages[role] });
});

// --- واجهات جديدة للتعديل والحذف ---

// تعديل مستخدم قائم
app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, password, role, grade, group, teacherId } = req.body;

        // البحث عن المستخدم بواسطة _id الخاص بـ MongoDB
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        // تحديث البيانات
        userToUpdate.name = name;
        userToUpdate.role = role;
        userToUpdate.grade = grade;
        userToUpdate.group = group;
        userToUpdate.teacherId = teacherId; // حفظ معرّف المعلم
        if (password) { // تحديث كلمة المرور فقط إذا تم إدخال واحدة جديدة
            userToUpdate.password = password; // ملاحظة: يجب تشفيرها في تطبيق حقيقي
        }

        const updatedUser = await userToUpdate.save();
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// حذف مستخدم
app.delete('/api/users/:userId', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.userId);
        res.json({ message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- واجهات API جديدة خاصة بالجدول الدراسي ---

// جلب جدول طالب معين
app.get('/api/schedule/:studentId', async (req, res) => {
    try {
        const student = await User.findOne({ id: req.params.studentId, role: 'student' });
        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }
        // نرسل اسم الطالب وجدوله
        res.json({ name: student.name, schedule: student.schedule });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// تحديث جدول طالب معين
app.put('/api/schedule/:studentId', async (req, res) => {
    try {
        const newSchedule = req.body.schedule;
        const updatedStudent = await User.findOneAndUpdate({ id: req.params.studentId }, { schedule: newSchedule }, { new: true });
        res.json(updatedStudent);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- واجهة API جديدة خاصة بالمعلم ---

// جلب الطلاب المرتبطين بمعلم معين
app.get('/api/teacher/students/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        // ابحث عن كل الطلاب الذين لديهم هذا الـ teacherId
        const students = await User.find({ role: 'student', teacherId: teacherId });
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- 6. منطق Socket.IO للتحديثات اللحظية ---

const userSockets = {}; // لتخزين socket id لكل مستخدم

io.on('connection', (socket) => {
    console.log('مستخدم جديد اتصل عبر Socket.IO:', socket.id);

    // عندما يقوم مستخدم بتسجيل نفسه بعد الدخول
    socket.on('register_user', (userId) => {
        console.log(`تسجيل المستخدم ${userId} مع الـ socket ${socket.id}`);
        userSockets[userId] = socket.id;
    });

    // الاستماع لحدث "إرسال رابط الجلسة" من المعلم
    socket.on('send_session_link', async (data) => {
        console.log(`المعلم يرسل رابطاً للصف: ${data.grade}, المجموعة: ${data.group}`);

        try {
            // 1. ابحث عن كل الطلاب الذين يطابقون الصف والمجموعة
            const targetStudents = await User.find({ role: 'student', grade: data.grade, group: data.group });

            // 2. أرسل الرابط لكل طالب على حدة
            for (const student of targetStudents) {
                const studentSocketId = userSockets[student.id];
                if (studentSocketId) {
                    io.to(studentSocketId).emit('session_link_update', { link: data.link, grade: data.grade });
                    console.log(`تم إرسال الرابط إلى الطالب: ${student.name}`);
                }
            }
        } catch (error) {
            console.error('حدث خطأ أثناء إرسال رابط الجلسة:', error);
        }
    });

    // الاستماع لحدث "تعيين واجب" من المعلم
    socket.on('assign_homework', (data) => {
        console.log(`المعلم يعين واجباً للطالب ${data.studentId}: ${data.homeworkText}`);
        const studentSocketId = userSockets[data.studentId];
        if (studentSocketId) {
            // إرسال الواجب إلى الطالب المحدد فقط
            io.to(studentSocketId).emit('new_homework', { text: data.homeworkText });
        }
    });

    // الاستماع لحدث "إرسال رابط جلسة مباشر" من المعلم
    socket.on('send_direct_session_link', (data) => {
        console.log(`المعلم يرسل رابطاً مباشراً للطالب: ${data.studentId}`);
        const studentSocketId = userSockets[data.studentId];
        if (studentSocketId) {
            // أرسل الرابط مباشرة للطالب بدون التحقق من الصف أو المجموعة
            io.to(studentSocketId).emit('session_link_update', { link: data.link });
            console.log(`تم إرسال الرابط المباشر بنجاح.`);
        }
    });

    socket.on('disconnect', () => {
        // إزالة المستخدم من القائمة عند قطع الاتصال
        for (const userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
        console.log('مستخدم قطع الاتصال:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
});