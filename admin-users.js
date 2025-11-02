document.addEventListener('DOMContentLoaded', function () {
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserForm = document.getElementById('addUserForm');
    const userRoleSelect = document.getElementById('newUserRole');
    const studentGradeRow = document.getElementById('studentGradeRow');
    const addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
    const formError = document.getElementById('formError');
    const modalTitle = document.getElementById('addUserModalLabel');
    const teacherSelect = document.getElementById('teacherSelect');

    // تم تحديث الرابط بعنوان الخادم الحقيقي على Render
    const SERVER_URL = 'https://quran-32vn.onrender.com';

    // --- بيانات وهمية للمحاكاة المحلية ---
    let editingUserId = null; // لتحديد ما إذا كنا في وضع التعديل أم الإضافة

    // دالة لجلب المعلمين وملء القائمة المنسدلة
    async function populateTeachersDropdown() {
        try {
            const response = await fetch(`${SERVER_URL}/api/teachers`);
            const teachers = await response.json();
            teacherSelect.innerHTML = '<option value="">بدون معلم</option>'; // إعادة تعيين
            teachers.forEach(teacher => {
                const option = `<option value="${teacher.id}">${teacher.name}</option>`;
                teacherSelect.insertAdjacentHTML('beforeend', option);
            });
        } catch (error) {
            console.error('فشل جلب قائمة المعلمين:', error);
        }
    }

    // دالة لجلب وعرض المستخدمين
    async function fetchAndDisplayUsers() {
        try {
            const response = await fetch(`${SERVER_URL}/api/users`);
            if (!response.ok) {
                throw new Error('فشل جلب بيانات المستخدمين');
            }
            const users = await response.json();
            displayUsers(users);
        } catch (error) {
            console.error('Error:', error);
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
        }
    }

    function displayUsers(users) {
            usersTableBody.innerHTML = ''; // تفريغ الجدول قبل ملئه

            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">لا يوجد مستخدمون لعرضهم.</td></tr>';
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
        studentGradeRow.style.display = isStudent ? 'flex' : 'none';
        // إظهار قائمة المعلمين فقط للطلاب
        teacherSelect.closest('.col-md-12').style.display = isStudent ? 'block' : 'none';
    });

    // التعامل مع تقديم نموذج إضافة مستخدم
    addUserForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        formError.style.display = 'none';

        const isEditing = !!editingUserId;

        const userData = {
            name: document.getElementById('newUserName').value,
            role: document.getElementById('newUserRole').value,
            grade: document.getElementById('newUserRole').value === 'student' ? document.getElementById('studentGrade').value : null,
            group: document.getElementById('newUserGroup').value || null,
            teacherId: document.getElementById('teacherSelect').value || null,
        };

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
                    
                    studentGradeRow.style.display = userToEdit.role === 'student' ? 'flex' : 'none';
                    document.getElementById('newUserGroup').value = userToEdit.group || '';
                    if (userToEdit.role === 'student') {
                        document.getElementById('studentGrade').value = userToEdit.grade;
                        document.getElementById('teacherSelect').value = userToEdit.teacherId || '';
                    }
                    addUserModal.show();
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    // جلب المستخدمين عند تحميل الصفحة
    populateTeachersDropdown();
    fetchAndDisplayUsers();
});