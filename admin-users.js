document.addEventListener('DOMContentLoaded', function () {
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserForm = document.getElementById('addUserForm');
    const studentGradeRow = document.getElementById('studentGradeRow');
    const teacherGroupRow = document.getElementById('teacherGroupRow');
    const addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
    const formError = document.getElementById('formError');
    const modalTitle = document.getElementById('addUserModalLabel');
    const teacherIdInput = document.getElementById('teacherIdInput');
    const userRoleSelect = document.getElementById('newUserRole');
    const verifyTeacherBtn = document.getElementById('verifyTeacherBtn');
    const teacherNameDisplay = document.getElementById('teacherNameDisplay');

    // تم التحديث ليعمل مع Koyeb
    const SERVER_URL = 'https://instant-leela-basilalnjjar47-3d3369a6.koyeb.app';

    // --- بيانات وهمية للمحاكاة المحلية ---
    // دالة لترجمة الأدوار إلى العربية
    function translateRole(role) {
        switch (role) {
            case 'admin': return 'إداري';
            case 'teacher': return 'معلم';
            case 'student': return 'طالب';
            default: return role;
        }
    }

    // دالة لملء قائمة الأدوار
    function populateRoles() {
        userRoleSelect.innerHTML = ['admin', 'teacher', 'student']
            .map(role => `<option value="${role}">${translateRole(role)}</option>`)
            .join('');
    }

    let allUsers = []; // --- جديد: متغير لتخزين قائمة المستخدمين المفلترة
    let editingUserId = null; // لتحديد ما إذا كنا في وضع التعديل أم الإضافة

    // دالة لجلب وعرض المستخدمين
    async function fetchAndDisplayUsers() {
        try {
            const response = await fetch(`${SERVER_URL}/api/users/all`);
            if (!response.ok) throw new Error('فشل جلب بيانات المستخدمين');
            
            const users = await response.json();
            
            allUsers = users;
            displayUsers(allUsers);

        } catch (error) {
            console.error('Error:', error);
            usersTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
        }
    }

    // --- دالة جديدة: لتنسيق عرض التواريخ ---
    function formatRelativeTime(dateString) {
        if (!dateString) return 'لم يسجل دخول';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return `قبل ${diffInSeconds} ثانية`;
        if (diffInSeconds < 3600) return `قبل ${Math.floor(diffInSeconds / 60)} دقيقة`;
        if (diffInSeconds < 86400) return `قبل ${Math.floor(diffInSeconds / 3600)} ساعة`;
        if (diffInSeconds < 2592000) return `قبل ${Math.floor(diffInSeconds / 86400)} يوم`;
        
        return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function displayUsers(users) {
            usersTableBody.innerHTML = ''; // تفريغ الجدول قبل ملئه

            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">لا يوجد مستخدمون لعرضهم.</td></tr>';
                return;
            }

            users.forEach(user => {
                let deleteBtn;
                // --- منطق جديد: منع حذف المدير الأصلي نهائياً ---
                if (user.id === '11111') {
                    deleteBtn = '<button class="btn btn-sm btn-outline-secondary" disabled title="لا يمكن حذف المدير الأصلي">حذف</button>';
                } else {
                    deleteBtn = `<button class="btn btn-sm btn-outline-danger delete-btn" data-user-id="${user.id}">حذف</button>`;
                }

                const row = `
                    <tr>
                        <td>${user.name || 'غير محدد'}</td>
                        <td>${user.id || 'N/A'}</td>
                        <td>${translateRole(user.role)}</td>
                        <td>${user.grade || 'N/A'}</td>
                        <td>${user.group || 'N/A'}</td>
                        <td>${user.teacherId || 'N/A'}</td>
                        <td>${formatRelativeTime(user.createdAt)}</td>
                        <td>${formatRelativeTime(user.lastLogin)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary edit-btn" data-user-id="${user._id}">تعديل</button>
                            ${deleteBtn}
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
        studentGradeRow.style.display = isStudent ? '' : 'none';
        teacherGroupRow.style.display = isTeacher ? '' : 'none';

        // إظهار حقل المعلم فقط للطالب
        if (isStudent) {
            document.getElementById('teacherIdRow').style.display = '';
        } else {
            document.getElementById('teacherIdRow').style.display = 'none';
        }
    });

    // التعامل مع تقديم نموذج إضافة مستخدم
    addUserForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        formError.style.display = 'none';

        const isEditing = !!editingUserId;

        const userData = {
            name: document.getElementById('newUserName').value,
            id: document.getElementById('newUserId').value,
            role: document.getElementById('newUserRole').value
        };

        if (userData.role === 'student') {
            userData.grade = document.getElementById('studentGrade').value;
            userData.group = document.getElementById('newUserGroup').value || null;
            userData.teacherId = document.getElementById('teacherIdInput').value.trim() || null; // الربط المباشر
        } else if (userData.role === 'teacher' || userData.role === 'admin') {
            userData.group = document.getElementById('teacherGroupSelect').value || null;
        }

        const password = document.getElementById('newUserPassword').value;
        if (password) { // أضف كلمة المرور فقط إذا تم إدخالها
            userData.password = password;
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
        populateRoles(); // إعادة ملء الأدوار
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
                    const response = await fetch(`${SERVER_URL}/api/users/${userId}`, { method: 'DELETE' }); // userId هنا هو رقم العضوية
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
                // --- التصحيح: استخدام القائمة المفلترة المخزنة بدلاً من استدعاء جديد ---
                const userToEdit = allUsers.find(u => u._id === userId);
                if (userToEdit) {
                    editingUserId = userId;
                    modalTitle.textContent = `تعديل بيانات: ${userToEdit.name}`;
                    document.getElementById('newUserName').value = userToEdit.name;
                    document.getElementById('newUserId').value = userToEdit.id;
                    document.getElementById('newUserId').readOnly = true;
                    document.getElementById('newUserRole').value = userToEdit.role;
                    document.getElementById('newUserPassword').value = '';
                    document.getElementById('newUserPassword').placeholder = 'اتركه فارغاً لعدم التغيير';
                    
                    const isStudent = userToEdit.role === 'student';
                    const isTeacher = userToEdit.role === 'teacher';

                    studentGradeRow.style.display = isStudent ? '' : 'none';
                    teacherGroupRow.style.display = isTeacher ? '' : 'none';
                    document.getElementById('teacherIdRow').style.display = isStudent ? '' : 'none';

                    if (isStudent) {
                        document.getElementById('studentGrade').value = userToEdit.grade;
                        document.getElementById('newUserGroup').value = userToEdit.group || '';
                        // التأكد من عرض المعلم المسؤول المحدد مسبقاً
                        document.getElementById('teacherIdInput').value = userToEdit.teacherId || '';
                        teacherNameDisplay.textContent = ''; // مسح رسالة التحقق عند فتح النافذة
                    } else if (isTeacher) {
                        document.getElementById('teacherGroupSelect').value = userToEdit.group || '';
                    } else if (userToEdit.role === 'admin') {
                        // لا توجد حقول إضافية للأدمن حالياً
                    }
                    addUserModal.show();
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    // --- جديد: التحقق من وجود المعلم ---
    verifyTeacherBtn.addEventListener('click', async function() {
        const teacherId = teacherIdInput.value.trim();
        if (!teacherId) {
            teacherNameDisplay.textContent = 'الرجاء إدخال رقم عضوية المعلم.';
            teacherNameDisplay.className = 'form-text mt-2 text-danger';
            return;
        }

        try {
            // --- التصحيح: استخدام القائمة المفلترة المخزنة بدلاً من استدعاء جديد ---
            const teacher = allUsers.find(u => u.id === teacherId && u.role === 'teacher');
            if (teacher) {
                teacherNameDisplay.textContent = `تم العثور على المعلم: ${teacher.name}`;
                teacherNameDisplay.className = 'form-text mt-2 text-success fw-bold';
            } else {
                teacherNameDisplay.textContent = 'لم يتم العثور على معلم بهذا الرقم.';
                teacherNameDisplay.className = 'form-text mt-2 text-danger';
            }
        } catch (error) {
            teacherNameDisplay.textContent = 'حدث خطأ أثناء التحقق.';
            teacherNameDisplay.className = 'form-text mt-2 text-danger';
        }
    });


    // جلب المستخدمين عند تحميل الصفحة
    populateRoles();
    fetchAndDisplayUsers();
});
