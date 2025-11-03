document.addEventListener('DOMContentLoaded', function () {
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserForm = document.getElementById('addUserForm');
    const userRoleSelect = document.getElementById('newUserRole');
    const studentGradeRow = document.getElementById('studentGradeRow');
    const teacherGroupRow = document.getElementById('teacherGroupRow');
    const addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
    const formError = document.getElementById('formError');
    const modalTitle = document.getElementById('addUserModalLabel');
    const teacherIdInput = document.getElementById('teacherIdInput');
    const verifyTeacherBtn = document.getElementById('verifyTeacherBtn');
    const teacherNameDisplay = document.getElementById('teacherNameDisplay');

    // تم تحديث الرابط بعنوان الخادم الحقيقي على Render
    const SERVER_URL = 'https://quran-32vn.onrender.com';

    // --- بيانات وهمية للمحاكاة المحلية ---
    let editingUserId = null; // لتحديد ما إذا كنا في وضع التعديل أم الإضافة

    // دالة لجلب وعرض المستخدمين
    async function fetchAndDisplayUsers() {
        try {
            const response = await fetch(`${SERVER_URL}/api/users/all`);
            if (!response.ok) {
                throw new Error('فشل جلب بيانات المستخدمين');
            }
            const users = await response.json();
            displayUsers(users);
        } catch (error) {
            console.error('Error:', error);
            usersTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
        }
    }

    function displayUsers(users) {
            usersTableBody.innerHTML = ''; // تفريغ الجدول قبل ملئه

            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">لا يوجد مستخدمون لعرضهم.</td></tr>';
                return;
            }

            users.forEach(user => {
                const row = `
                    <tr>
                        <td>${user.name || 'غير محدد'}</td>
                        <td>${user.id}</td>
                        <td>${user.role === 'student' ? 'طالب' : (user.role === 'teacher' ? 'معلم' : 'إداري')}</td>
                        <td>${user.grade || 'N/A'}</td>
                        <td>${user.group || 'N/A'}</td>
                        <td>${user.teacherId || 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-btn" data-user-id="${user._id}">تعديل</button>
                            <button class="btn btn-sm btn-outline-danger delete-btn" data-user-id="${user._id}">حذف</button>
                        </td>
                    </tr>
                `;
                usersTableBody.insertAdjacentHTML('beforeend', row);
            });
    }

    // إظهار/إخفاء حقل الصف الدراسي بناءً على نوع الحساب
    userRoleSelect.addEventListener('change', function () {
        const isStudent = this.value === 'student';
        const isTeacher = this.value === 'teacher';
        studentGradeRow.style.display = isStudent ? 'flex' : 'none';
        teacherGroupRow.style.display = isTeacher ? 'flex' : 'none'; 
    });

    // التحقق من هوية المعلم عند الضغط على زر "تحقق"
    verifyTeacherBtn.addEventListener('click', async () => {
        const teacherId = teacherIdInput.value.trim();
        if (!teacherId) {
            teacherNameDisplay.textContent = 'الرجاء إدخال رقم عضوية المعلم.';
            teacherNameDisplay.className = 'form-text text-danger';
            return;
        }

        try {
            const response = await fetch(`${SERVER_URL}/api/users/all`); // جلب كل المستخدمين للبحث بينهم
            const users = await response.json(); // استلام القائمة كاملة

            if (!response.ok) throw new Error('فشل جلب بيانات المستخدمين للتحقق');

            // البحث عن المعلم المطلوب داخل القائمة
            const user = users.find(u => u.id === teacherId);

            if (user && user.role === 'teacher') {
                teacherNameDisplay.textContent = `تم العثور على المعلم: ${user.name}`;
                teacherNameDisplay.className = 'form-text text-success fw-bold';
            } else {
                teacherNameDisplay.textContent = 'رقم العضوية هذا لا يخص معلماً.';
                teacherNameDisplay.className = 'form-text text-danger';
            }
        } catch (error) {
            teacherNameDisplay.textContent = error.message || 'فشل التحقق من المعلم.';
            teacherNameDisplay.className = 'form-text text-danger';
        }
    });

    // التعامل مع تقديم نموذج إضافة مستخدم
    addUserForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        formError.style.display = 'none';

        const isEditing = !!editingUserId;

        const userData = {
            name: document.getElementById('newUserName').value,
            role: document.getElementById('newUserRole').value
        };

        if (userData.role === 'student') {
            userData.grade = document.getElementById('studentGrade').value;
            userData.group = document.getElementById('newUserGroup').value || null;
            userData.teacherId = document.getElementById('teacherIdInput').value.trim() || null; // الربط المباشر
        } else if (userData.role === 'teacher') {
            userData.group = document.getElementById('teacherGroupSelect').value || null;
        }

        const password = document.getElementById('newUserPassword').value;
        if (password || !isEditing) { // أضف كلمة المرور إذا كانت موجودة أو في حالة إنشاء مستخدم جديد
            userData.password = password;
        }

        if (!isEditing) {
            userData.id = document.getElementById('newUserId').value;
        }

        // تحديد الرابط والطريقة (إضافة أو تعديل)
        const url = isEditing ? `${SERVER_URL}/api/users/${editingUserId}` : `${SERVER_URL}/api/users`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (!response.ok) {
                formError.textContent = result.message || 'حدث خطأ غير متوقع.';
                formError.style.display = 'block';
                return;
            }

            addUserModal.hide();
            await fetchAndDisplayUsers();

        } catch (error) {
            formError.textContent = 'فشل الاتصال بالخادم.';
            formError.style.display = 'block';
        }
    });

    // إعادة تعيين النموذج عند إغلاق النافذة
    document.getElementById('addUserModal').addEventListener('hidden.bs.modal', function () {
        editingUserId = null;
        modalTitle.textContent = 'إضافة مستخدم جديد';
        addUserForm.reset();
        document.getElementById('newUserId').readOnly = false;
        document.getElementById('newUserPassword').placeholder = 'كلمة مرور مؤقتة';
        formError.style.display = 'none';
        teacherNameDisplay.textContent = ''; // مسح رسالة التحقق
        teacherIdInput.value = '';
    });

    // التعامل مع النقر على أزرار الجدول (تعديل وحذف)
    usersTableBody.addEventListener('click', async function(event) {
        const target = event.target;
        const userId = target.dataset.userId;

        if (!userId) return;

        // --- منطق الحذف ---
        if (event.target.classList.contains('delete-btn')) {
            // إظهار رسالة تأكيد
            if (confirm('هل أنت متأكد من رغبتك في حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) {
                try {
                    const response = await fetch(`${SERVER_URL}/api/users/${userId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('فشل الحذف');
                    await fetchAndDisplayUsers();
                } catch (error) {
                    console.error('Error:', error);
                    alert('حدث خطأ أثناء حذف المستخدم.');
                }
            }
        }


        // --- منطق التعديل ---
        if (target.classList.contains('edit-btn')) {
            try {
                const response = await fetch(`${SERVER_URL}/api/users`);
                const users = await response.json();
                const userToEdit = users.find(u => u._id === userId);

                if (userToEdit) {
                    editingUserId = userId;
                    modalTitle.textContent = 'تعديل بيانات المستخدم';
                    document.getElementById('newUserName').value = userToEdit.name;
                    document.getElementById('newUserId').value = userToEdit.id;
                    document.getElementById('newUserId').readOnly = true;
                    document.getElementById('newUserRole').value = userToEdit.role;
                    document.getElementById('newUserPassword').value = '';
                    document.getElementById('newUserPassword').placeholder = 'اتركه فارغاً لعدم التغيير';
                    
                    const isStudent = userToEdit.role === 'student';
                    const isTeacher = userToEdit.role === 'teacher';

                    studentGradeRow.style.display = isStudent ? 'flex' : 'none';
                    teacherGroupRow.style.display = isTeacher ? 'flex' : 'none';

                    if (userToEdit.role === 'student') {
                        document.getElementById('studentGrade').value = userToEdit.grade;
                        document.getElementById('newUserGroup').value = userToEdit.group || '';
                        // التأكد من عرض المعلم المسؤول المحدد مسبقاً
                        document.getElementById('teacherIdInput').value = userToEdit.teacherId || '';
                        teacherNameDisplay.textContent = ''; // مسح رسالة التحقق عند فتح النافذة
                    } else if (userToEdit.role === 'teacher') {
                        document.getElementById('teacherGroupSelect').value = userToEdit.group || '';
                    }
                    addUserModal.show();
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    // جلب المستخدمين عند تحميل الصفحة
    fetchAndDisplayUsers();
});
