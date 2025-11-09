document.addEventListener('DOMContentLoaded', function() {
    const studentCountEl = document.getElementById('studentTotalCount');
    const teacherCountEl = document.getElementById('teacherTotalCount');
    const SERVER_URL = 'https://quran-32vn.onrender.com';

    async function fetchStats() {
        // التأكد من وجود العناصر قبل محاولة تحديثها
        if (!studentCountEl || !teacherCountEl) {
            console.error('Elements for stats not found!');
            return;
        }

        try {
            const response = await fetch(`${SERVER_URL}/api/stats/overview`);
            if (!response.ok) {
                throw new Error('فشل جلب الإحصائيات');
            }
            const stats = await response.json();

            // تحديث الأرقام في الصفحة
            studentCountEl.textContent = stats.totalStudents || 0;
            teacherCountEl.textContent = stats.totalTeachers || 0;

        } catch (error) {
            console.error('Error fetching stats:', error);
            // في حالة حدوث خطأ، نعرض رسالة للمستخدم
            studentCountEl.textContent = 'خطأ';
            teacherCountEl.textContent = 'خطأ';
        }
    }

    // استدعاء الدالة لجلب الإحصائيات عند تحميل الصفحة
    fetchStats();
});