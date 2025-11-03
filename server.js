// =======================
// استيراد المكتبات
// =======================
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// =======================
// إعداد التطبيق
// =======================
const app = express();
app.use(express.json());
app.use(cors());

// =======================
// إعداد الاتصال بقاعدة البيانات
// =======================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
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
const upload = multer({ storage });

// =======================
// نموذج قاعدة البيانات (Slide)
// =======================
const slideSchema = new mongoose.Schema({
  title: { type: String, required: false }, // جعلها اختيارية
  text: { type: String, required: false },  // جعلها اختيارية
  imageUrl: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const Slide = mongoose.model('Slide', slideSchema);

// =======================
// المسارات (Routes)
// =======================

// ✅ عرض كل السلايدات
app.get('/api/slides', async (req, res) => {
  try {
    const slides = await Slide.find().sort({ order: 1 });
    res.json(slides);
  } catch (error) {
    console.error('❌ خطأ في جلب السلايدات:', error);
    res.status(500).json({ message: 'فشل في جلب السلايدات من الخادم' });
  }
});

// ✅ إضافة شريحة جديدة
app.post('/api/slides', upload.single('imageFile'), async (req, res) => {
  try {
    const { title, text } = req.body;

    // تأكيد وجود الصورة
    if (!req.file) {
      return res.status(400).json({ message: 'الرجاء رفع ملف صورة.' });
    }

    // رفع الصورة إلى Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "quran_slides"
    });

    // إنشاء الشريحة الجديدة
    const newSlide = new Slide({
      title: title?.trim() || '',
      text: text?.trim() || '',
      imageUrl: result.secure_url,
      isActive: req.body.isActive ?? true,
      order: req.body.order ?? 0
    });

    await newSlide.save();
    res.status(201).json(newSlide);

  } catch (error) {
    console.error('❌ خطأ أثناء حفظ الشريحة:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'بيانات الشريحة غير مكتملة أو غير صحيحة.' });
    }
    res.status(500).json({ message: 'حدث خطأ داخلي في الخادم أثناء حفظ الشريحة.' });
  }
});

// ✅ تعديل شريحة
app.put('/api/slides/:id', upload.single('imageFile'), async (req, res) => {
  try {
    const { title, text, isActive, order } = req.body;
    const updateData = { title, text, isActive, order };

    // لو تم رفع صورة جديدة
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "quran_slides"
      });
      updateData.imageUrl = result.secure_url;
    }

    const updatedSlide = await Slide.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedSlide) {
      return res.status(404).json({ message: 'الشريحة غير موجودة.' });
    }

    res.json(updatedSlide);
  } catch (error) {
    console.error('❌ خطأ أثناء تعديل الشريحة:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل الشريحة.' });
  }
});

// ✅ حذف شريحة
app.delete('/api/slides/:id', async (req, res) => {
  try {
    const deletedSlide = await Slide.findByIdAndDelete(req.params.id);
    if (!deletedSlide) {
      return res.status(404).json({ message: 'الشريحة غير موجودة.' });
    }
    res.json({ message: 'تم حذف الشريحة بنجاح.' });
  } catch (error) {
    console.error('❌ خطأ أثناء حذف الشريحة:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء حذف الشريحة.' });
  }
});

// =======================
// تشغيل الخادم
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`));
