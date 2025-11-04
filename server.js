// =======================
// استيراد المكتبات
// =======================
const express = require('express');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// =======================
// إعداد التطبيق
// =======================
const app = express();
const server = require('http').createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

app.use(express.json());
app.use(cors());

// =======================
// إعداد الاتصال بقاعدة البيانات
// =======================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح'))
    .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// =======================
// إعداد Cloudinary
// =======================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// =======================
// إعداد رفع الملفات
// =======================
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// =======================
// نماذج قاعدة البيانات
// =======================

// --- نموذج المستخدمين ---
const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['student', 'teacher', 'admin'] },
    grade: { type: String },
    group: { type: String },
    teacherId: { type: String },
    responsibleForGroup: { type: String },
    schedule: [{
        day: String,
        time: String,
        teacher: String,
        plan: String,
        // --- الحقول الجديدة للجلسات ---
        sessionLink: { type: String, default: null },
        sessionActive: { type: Boolean, default: false }
    }],
    attendance: [{
        date: String,
        status: String
    }]
});
const User = mongoose.model('User', userSchema);

// --- نموذج الشرائح الإعلانية ---
const slideSchema = new mongoose.Schema({
    title: { type: String, required: false }, // جعل العنوان اختيارياً
    text: { type: String, required: false },  // جعل النص اختيارياً
    imageUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
});
const Slide = mongoose.model('Slide', slideSchema);

// =======================
// دالة لإنشاء حساب المدير الافتراضي
// =======================
async function createDefaultAdminIfNeeded() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const defaultAdmin = new User({
                id: 'admin',
                name: 'المدير العام',
                password: 'admin', // كلمة مرور بسيطة، يجب تغييرها
                role: 'admin'
            });
            await defaultAdmin.save();
            console.log('✅ تم إنشاء حساب المدير الافتراضي بنجاح.');
        }
    } catch (error) {
        console.error('❌ فشل في إنشاء حساب المدير الافتراضي:', error);
    }
}

// =======================
// المسارات (Routes)
// =======================

// --- مسارات المستخدمين وتسجيل الدخول ---
app.post('/api/login', async (req, res) => {
    const { id, password } = req.body;
    const user = await User.findOne({ id: id });
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });
    if (user.password !== password) return res.status(401).json({ message: 'كلمة المرور غير صحيحة.' });
    const pages = { student: 'student-dashboard.html', teacher: 'teacher-dashboard.html', admin: 'admin-dashboard.html' };
    res.json({ message: 'تم تسجيل الدخول بنجاح', user: user, redirectTo: pages[user.role] });
});

app.post('/api/users', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json(newUser);
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: 'رقم العضوية مستخدم بالفعل.' });
        res.status(400).json({ message: 'فشلت إضافة المستخدم.' });
    }
});

app.get('/api/users/all', async (req, res) => {
    const users = await User.find();
    res.json(users);
});

app.get('/api/teacher/students', async (req, res) => {
    const { teacherId } = req.query;
    const students = await User.find({ role: 'student', teacherId: teacherId });
    res.json(students);
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findOne({ id: req.params.id });
        if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });
        if (user.role === 'admin') {
            return res.status(400).json({ message: 'لا يمكن حذف حسابات الأدمن.' });
        }
        await User.deleteOne({ id: req.params.id });

        // تأكيد وجود أدمن واحد على الأقل دائماً
        const anyAdmin = await User.findOne({ role: 'admin' });
        if (!anyAdmin) {
            await createDefaultAdminIfNeeded();
        }

        res.json({ message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ أثناء الحذف.' });
    }
});

// --- مسارات الجداول الدراسية ---
app.get('/api/schedule/:studentId', async (req, res) => {
    const user = await User.findOne({ id: req.params.studentId });
    if (!user) return res.status(404).json({ message: 'الطالب غير موجود' });
    res.json({ name: user.name, schedule: user.schedule });
});

app.put('/api/schedule/:studentId', async (req, res) => {
    const { schedule } = req.body;
    await User.updateOne({ id: req.params.studentId }, { $set: { schedule: schedule } });
    res.json({ message: 'تم تحديث الجدول بنجاح' });
});

// --- مسار جديد: تحديث رابط جلسة لطالب ---
app.put('/api/session/:studentId', async (req, res) => {
    const { sessionLink, sessionActive } = req.body;
    try {
        // نستخدم findOneAndUpdate للعثور على الطالب وتحديث بياناته
        const updatedUser = await User.findOneAndUpdate(
            { id: req.params.studentId },
            { $set: { "schedule.$[].sessionLink": sessionLink, "schedule.$[].sessionActive": sessionActive } },
            { new: true } // هذا الخيار يعيد المستند بعد التحديث
        );

        if (!updatedUser) return res.status(404).json({ message: 'الطالب غير موجود' });

        res.json({ message: 'تم تحديث رابط الجلسة بنجاح', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- مسارات الحضور والغياب ---
app.post('/api/attendance', async (req, res) => {
    const { date, records } = req.body;
    try {
        for (const record of records) {
            await User.updateOne(
                { id: record.studentId },
                { $pull: { attendance: { date: date } } }
            );
            await User.updateOne(
                { id: record.studentId },
                { $push: { attendance: { date: date, status: record.status } } }
            );
        }
        res.status(200).json({ message: 'تم تسجيل الحضور بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- مسار جديد: جلب سجل حضور طالب معين ---
app.get('/api/attendance/:studentId', async (req, res) => {
    const user = await User.findOne({ id: req.params.studentId });
    if (!user) return res.status(404).json({ message: 'الطالب غير موجود' });
    // نرسل اسم الطالب وسجل الحضور الخاص به فقط
    res.json({ name: user.name, attendance: user.attendance });
});

// --- مسارات السلايدر الإعلاني ---
app.get('/api/slides', async (req, res) => {
    try {
        const slides = await Slide.find({ isActive: true }).sort({ order: 'asc' });
        res.json(slides);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

app.get('/api/slides/all', async (req, res) => {
    try {
        const slides = await Slide.find().sort({ order: 'asc' });
        res.json(slides);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

app.post('/api/slides', upload.single('imageFile'), async (req, res) => {
    try {
        let imageUrl = '';
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            const result = await cloudinary.uploader.upload(dataURI, { folder: "quran_slides" });
            imageUrl = result.secure_url;
        } else {
            return res.status(400).json({ message: 'الرجاء رفع ملف صورة.' });
        }
        const newSlide = new Slide({ ...req.body, imageUrl: imageUrl });
        await newSlide.save();
        res.status(201).json(newSlide);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'فشلت إضافة الشريحة بسبب خطأ في الخادم' });
    }
});

app.put('/api/slides/:id', upload.single('imageFile'), async (req, res) => {
    try {
        const slideToUpdate = await Slide.findById(req.params.id);
        if (!slideToUpdate) return res.status(404).json({ message: 'الشريحة غير موجودة' });
        let imageUrl = slideToUpdate.imageUrl;
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            const result = await cloudinary.uploader.upload(dataURI, { folder: "quran_slides" });
            imageUrl = result.secure_url;
        }
        const updatedData = { ...req.body, imageUrl: imageUrl };
        const updatedSlide = await Slide.findByIdAndUpdate(req.params.id, updatedData, { new: true });
        res.json(updatedSlide);
    } catch (error) {
        res.status(500).json({ message: 'فشل تعديل الشريحة' });
    }
});

app.delete('/api/slides/:id', async (req, res) => {
    await Slide.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الشريحة بنجاح' });
});

// =======================
// منطق Socket.IO
// =======================
const userSockets = {};
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    socket.on('register_user', (userId) => {
        userSockets[userId] = socket.id;
        console.log(`User ${userId} registered with socket ${socket.id}`);
    });
    socket.on('send_link_to_students', (data) => {
        data.studentIds.forEach(studentId => {
            const studentSocketId = userSockets[studentId];
            if (studentSocketId) {
                io.to(studentSocketId).emit('session_link_update', { link: data.link });
            }
        });
    });
    socket.on('disconnect', () => {
        for (const userId in userSockets) {
            if (userSockets[userId] === socket.id) {
                delete userSockets[userId];
                break;
            }
        }
        console.log('user disconnected');
    });
});

// =======================
// تشغيل الخادم
// =======================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
    createDefaultAdminIfNeeded();
});

// =======================
// إبقاء الخادم نشطاً على Render
// =======================
if (process.env.RENDER_EXTERNAL_URL) {
    const PING_URL = process.env.RENDER_EXTERNAL_URL;
    setInterval(() => {
        axios.get(PING_URL, { timeout: 10000 })
            .then(response => console.log(`Self-ping successful at ${new Date().toISOString()}. Status: ${response.status}`))
            .catch(err => console.error(`Self-ping error to ${PING_URL}:`, err.message));
    }, 14 * 60 * 1000);
}
