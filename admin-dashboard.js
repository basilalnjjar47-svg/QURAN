document.addEventListener('DOMContentLoaded', function() {
    const studentCountEl = document.getElementById('studentTotalCount');
    const teacherCountEl = document.getElementById('teacherTotalCount');
    const SERVER_URL = 'https://quran-32vn.onrender.com';
    const activityLogList = document.getElementById('activityLogList');

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

    // --- جديد: دالة لجلب أحدث الأنشطة ---
    async function fetchActivityLog() {
        if (!activityLogList) return;

        try {
            const response = await fetch(`${SERVER_URL}/api/users/all`);
            if (!response.ok) throw new Error('فشل جلب المستخدمين');
            
            let users = await response.json();
            
            // فلترة المستخدمين الذين سجلوا دخولاً وترتيبهم حسب آخر دخول
            const activeUsers = users
                .filter(u => u.lastLogin)
                .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
                .slice(0, 5); // عرض آخر 5 أنشطة فقط

            activityLogList.innerHTML = '';

            if (activeUsers.length === 0) {
                activityLogList.innerHTML = '<li class="list-group-item text-center text-muted">لا توجد أنشطة مسجلة بعد.</li>';
                return;
            }

            activeUsers.forEach(user => {
                const item = `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold">${user.name}</span>
                            <small class="text-muted">(${user.role === 'teacher' ? 'معلم' : 'طالب'})</small>
                        </div>
                        <small>${new Date(user.lastLogin).toLocaleString('ar-EG')}</small>
                    </li>
                `;
                activityLogList.insertAdjacentHTML('beforeend', item);
            });

        } catch (error) {
            activityLogList.innerHTML = '<li class="list-group-item text-center text-danger">حدث خطأ أثناء تحميل الأنشطة.</li>';
        }
    }

    // استدعاء الدالة لجلب الإحصائيات عند تحميل الصفحة
    fetchStats();
    fetchActivityLog();
});