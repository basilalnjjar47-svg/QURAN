const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config(); // لتحميل متغيرات البيئة من ملف .env

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

// --- إعداد Cloudinary للتخزين السحابي ---
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// التحقق من وجود مفاتيح Cloudinary
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('****************************************************************');
    console.error('!! خطأ فادح: مفاتيح خدمة Cloudinary غير موجودة في ملف .env');
    console.error('!! الرجاء التأكد من إعداد ملف .env بشكل صحيح لتعمل ميزة رفع الصور.');
    console.error('****************************************************************');
}

// --- إعداد Multer لمعالجة رفع الملفات ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage
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

const attendanceSchema = new mongoose.Schema({
    date: { type: String, required: true }, // تاريخ اليوم بصيغة YYYY-MM-DD
    status: { type: String, enum: ['present', 'absent', 'excused'], required: true } // الحالة: حاضر، غائب، معذور
});

const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    grade: String,
    attendance: [attendanceSchema], // حقل جديد لتخزين سجل الحضور
    group: String, // حقل جديد لتحديد المجموعة (أ, ب, ج, ...)
    schedule: [scheduleItemSchema], // حقل جديد لتخزين جدول الطالب
    // --- إضافة جديدة: حقل لربط الطالب بالمعلم ---
    teacherId: { type: String, default: null } 
});
const User = mongoose.model('User', userSchema);

// --- نموذج جديد للشرائح الإعلانية (السلايدر) ---
const slideSchema = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String, required: true },
    imageUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
});
const Slide = mongoose.model('Slide', slideSchema);

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
    try {
        const filter = {};
        // فلترة حسب الدور (طالب، معلم) إذا تم تحديده
        if (req.query.role) filter.role = req.query.role;
        // فلترة حسب المجموعة إذا تم تحديدها
        if (req.query.group) filter.group = req.query.group;
        const users = await User.find(filter);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
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

// واجهة جديدة للبحث عن مستخدم برقم العضوية
app.get('/api/user-by-id/:id', async (req, res) => {
    try {
        const user = await User.findOne({ id: req.params.id });
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }
        res.json(user); // إرجاع بيانات المستخدم كاملة أو جزئية حسب الحاجة
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- واجهة جديدة لتسجيل الدخول ---
app.post('/api/login', async (req, res) => {
    const { id, password } = req.body; // لم نعد بحاجة لاستقبال الدور

    const user = await User.findOne({ id: id });

    if (!user) {
        return res.status(404).json({ message: 'رقم العضوية غير موجود.' });
    }

    // في تطبيق حقيقي، يجب مقارنة كلمة المرور المشفرة
    if (user.password !== password) {
        return res.status(401).json({ message: 'كلمة المرور غير صحيحة.' });
    }

    // بما أننا لم نعد نستقبل الدور، لم نعد بحاجة للتحقق منه هنا

    const pages = {
        student: 'student-dashboard.html',
        teacher: 'teacher-dashboard.html',
        admin: 'admin-dashboard.html'
    };
    res.json({ message: 'تم تسجيل الدخول بنجاح', user: user, redirectTo: pages[user.role] });
});

// --- واجهات جديدة للتعديل والحذف ---

// تعديل مستخدم قائم
app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, password, role, grade, group, teacherId } = req.body; // group will now be used for teachers too

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
        userToUpdate.teacherId = teacherId; // حفظ معرّف المعلم كنص
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

// --- واجهات API جديدة خاصة بالحضور والغياب ---

// جلب سجل حضور طالب معين
app.get('/api/attendance/:studentId', async (req, res) => {
    try {
        const student = await User.findOne({ id: req.params.studentId }, 'name attendance');
        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// تسجيل الحضور لمجموعة من الطلاب في يوم معين
app.post('/api/attendance', async (req, res) => {
    const { date, records } = req.body; // records is an array of { studentId, status }
    if (!date || !records) {
        return res.status(400).json({ message: 'بيانات غير مكتملة' });
    }

    try {
        for (const record of records) {
            // إزالة أي سجل قديم لنفس الطالب في نفس اليوم
            await User.updateOne({ id: record.studentId }, { $pull: { attendance: { date: date } } });
            // إضافة السجل الجديد
            await User.updateOne({ id: record.studentId }, { $push: { attendance: { date: date, status: record.status } } });
        }
        res.status(200).json({ message: 'تم تسجيل الحضور بنجاح' });
    } catch (error) {
        console.error('Error saving attendance:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء حفظ الحضور' });
    }
});

// --- واجهة API جديدة خاصة بالمعلم ---

// جلب الطلاب المرتبطين بمعلم معين بشكل مباشر
app.get('/api/teacher/students', async (req, res) => {
    try {
        const teacherId = req.query.teacherId;
        if (!teacherId) {
            return res.status(400).json({ message: 'لم يتم تحديد معرّف المعلم' });
        }

        // 1. ابحث عن المعلم سواء برقم العضوية (id) أو بالمعرف الخاص بقاعدة البيانات (_id)
        const teacher = await User.findOne({ $or: [{ id: teacherId }, { _id: mongoose.isValidObjectId(teacherId) ? teacherId : null }] });
        if (!teacher) {
            return res.status(404).json({ message: 'لم يتم العثور على المعلم' });
        }

        // 2. ابحث عن الطلاب باستخدام رقم العضوية (id) الصحيح والموحّد للمعلم
        const students = await User.find({ role: 'student', teacherId: teacher.id });
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// --- واجهات API جديدة خاصة بالسلايدر الإعلاني ---

// جلب كل الشرائح النشطة (لصفحة الموقع الرئيسية)
app.get('/api/slides', async (req, res) => {
    try {
        const slides = await Slide.find({ isActive: true }).sort({ order: 'asc' });
        res.json(slides);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// جلب كل الشرائح (للأدمن)
app.get('/api/slides/all', async (req, res) => {
    try {
        const slides = await Slide.find().sort({ order: 'asc' });
        res.json(slides);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// إضافة شريحة جديدة
app.post('/api/slides', upload.single('imageFile'), async (req, res) => {
    try {
        let imageUrl = '';
        // إذا تم رفع ملف صورة
        if (req.file) {
            // تحويل الملف إلى صيغة يمكن لـ Cloudinary فهمها
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            
            // رفع الصورة إلى Cloudinary
            const result = await cloudinary.uploader.upload(dataURI, {
                folder: "quran_slides" // اسم المجلد في Cloudinary
            });
            imageUrl = result.secure_url;
        } else {
            return res.status(400).json({ message: 'الرجاء رفع ملف صورة.' });
        }

        const newSlide = new Slide({
            ...req.body,
            imageUrl: imageUrl
        });

        await newSlide.save();
        res.status(201).json(newSlide);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'فشلت إضافة الشريحة بسبب خطأ في الخادم' });
    }
});

// تعديل شريحة
app.put('/api/slides/:id', upload.single('imageFile'), async (req, res) => {
    try {
        const slideToUpdate = await Slide.findById(req.params.id);
        if (!slideToUpdate) {
            return res.status(404).json({ message: 'الشريحة غير موجودة' });
        }

        let imageUrl = slideToUpdate.imageUrl; // استخدام الصورة القديمة كافتراضي

        // إذا تم رفع صورة جديدة
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString("base64");
            let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
            const result = await cloudinary.uploader.upload(dataURI, { folder: "quran_slides" });
            imageUrl = result.secure_url;
        }

        const updatedData = {
            ...req.body,
            imageUrl: imageUrl
        };

        const updatedSlide = await Slide.findByIdAndUpdate(req.params.id, updatedData, { new: true });
        res.json(updatedSlide);
    } catch (error) {
        res.status(500).json({ message: 'فشل تعديل الشريحة' });
    }
});

// حذف شريحة
app.delete('/api/slides/:id', async (req, res) => {
    await Slide.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الشريحة بنجاح' });
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

    // الاستماع لحدث "إرسال رابط لمجموعة طلاب" من المعلم
    socket.on('send_link_to_students', (data) => {
        const { studentIds, link } = data;
        if (!studentIds || !link || studentIds.length === 0) {
            return;
        }
        console.log(`المعلم يرسل رابطاً للطلاب: ${studentIds.join(', ')}`);
        for (const studentId of studentIds) {
            const studentSocketId = userSockets[studentId];
            if (studentSocketId) {
                io.to(studentSocketId).emit('session_link_update', { link: link, grade: `جلسة مع معلمك` });
                console.log(`تم إرسال الرابط إلى الطالب: ${studentId}`);
            }
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

// --- Self-ping لإبقاء السيرفر نشطاً على Render ---
// هذا الجزء يمنع الخادم من الدخول في وضع السكون
const axios = require('axios');
if (process.env.RENDER_EXTERNAL_URL) {
  const PING_URL = process.env.RENDER_EXTERNAL_URL;
  setInterval(() => {
    axios.get(PING_URL)
      .then(response => console.log(`Self-ping successful at ${new Date().toISOString()}. Status: ${response.status}`))
      .catch(err => console.error(`Self-ping error to ${PING_URL}:`, err.message));
  }, 14 * 60 * 1000); // كل 14 دقيقة (أقل من 15 دقيقة التي ينام بعدها الخادم)
}
// ----------------------------------------------------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
});
