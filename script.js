let isRegisterMode = false;

function openLoginDialog() {
    const dialog = document.getElementById('loginDialog');
    dialog.classList.add('visible');
    // التأكد من العودة لوضع تسجيل الدخول الافتراضي عند فتح النافذة
    switchToLoginView(false); 
}

function closeLoginDialog() {
    const dialog = document.getElementById('loginDialog');
    dialog.classList.remove('visible');
}

document.getElementById('loginDialog')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeLoginDialog();
    }
});

const authForm = document.getElementById('authForm');
const dialogTitle = document.getElementById('dialogTitle');
const nameField = document.getElementById('dialogNameField');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleText = document.getElementById('authToggleText');
const authError = document.getElementById('dialogAuthError');

function switchToRegisterView() {
    isRegisterMode = true;
    dialogTitle.textContent = 'إنشاء حساب جديد';
    nameField.style.display = 'block';
    document.getElementById('dialogName').required = true;
    authSubmitBtn.textContent = 'إنشاء الحساب';
    authToggleText.innerHTML = 'لديك حساب بالفعل؟ <a href="#" id="switchToLogin">سجّل الدخول</a>';
    document.getElementById('switchToLogin').addEventListener('click', (e) => { e.preventDefault(); switchToLoginView(true); });
    authError.style.display = 'none';
}

function switchToLoginView(isToggle) {
    isRegisterMode = false;
    dialogTitle.textContent = 'تسجيل الدخول';
    nameField.style.display = 'none';
    document.getElementById('dialogName').required = false;
    authSubmitBtn.textContent = 'تسجيل الدخول';
    authToggleText.innerHTML = 'ليس لديك حساب؟ <a href="#" id="switchToRegister">أنشئ حساباً جديداً</a>';
    if (isToggle) { // فقط أضف المستمع إذا كان التبديل من داخل النافذة
        document.getElementById('switchToRegister').addEventListener('click', (e) => { e.preventDefault(); switchToRegisterView(); });
    }
    authError.style.display = 'none';
}

// المستمع الأولي عند تحميل الصفحة
document.getElementById('switchToRegister').addEventListener('click', (e) => { e.preventDefault(); switchToRegisterView(); });


authForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    authError.style.display = 'none';
    const SERVER_URL = 'https://quran-32vn.onrender.com';

    const userData = {
        id: document.getElementById('dialogUserId').value,
        password: document.getElementById('dialogPassword').value,
    };

    let url, method;

    if (isRegisterMode) {
        url = `${SERVER_URL}/api/users`;
        method = 'POST';
        userData.name = document.getElementById('dialogName').value;
        userData.role = 'student'; // الحسابات الجديدة دائماً طلاب
    } else {
        url = `${SERVER_URL}/api/login`;
        method = 'POST';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const result = await response.json();

        if (!response.ok) {
            authError.textContent = result.message || 'حدث خطأ ما.';
            authError.style.display = 'block';
            return;
        }

        if (isRegisterMode) {
            alert('تم إنشاء حسابك بنجاح! سيقوم المشرف بمراجعة طلبك وتفعيل اشتراكك. يمكنك الآن تسجيل الدخول.');
            switchToLoginView(true);
        } else {
            sessionStorage.setItem('currentUser', JSON.stringify(result.user));
            document.body.classList.add('is-transitioning');
            setTimeout(() => { window.location.href = result.redirectTo; }, 200);
        }
    } catch (error) {
        authError.textContent = 'لا يمكن الاتصال بالخادم. الرجاء المحاولة لاحقاً.';
        authError.style.display = 'block';
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target); // Stop observing after animation
        }
    });
}, observerOptions);

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        mainNavbar.classList.add('scrolled');
    } else {
        mainNavbar.classList.remove('scrolled');
    }
});

const mainNavbar = document.querySelector('.navbar-main');

document.addEventListener('DOMContentLoaded', () => {
    // تأثير الظهور المتتالي للبطاقات ورؤوس الأقسام
    const elementsToObserve = document.querySelectorAll('.role-card, .feature-card, .section-header, .method-item, .stat-item');
    elementsToObserve.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        if (el.classList.contains('role-card') || el.classList.contains('feature-card') || el.classList.contains('method-item') || el.classList.contains('stat-item')) {
            const delay = (index % 3) * 150; // تأخير متتالي للبطاقات
            el.style.transitionDelay = `${delay}ms`;
        }
        observer.observe(el);
    });

    // تأثير عداد الأرقام لقسم الإحصائيات
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counters = entry.target.querySelectorAll('.stat-number');
                counters.forEach(counter => {
                    const target = +counter.getAttribute('data-target');
                    let current = 0;
                    const increment = target / 100; // لعمل 100 خطوة للعداد

                    const updateCounter = () => {
                        if (current < target) {
                            current += increment;
                            counter.innerText = Math.ceil(current);
                            requestAnimationFrame(updateCounter);
                        } else {
                            counter.innerText = target;
                        }
                    };
                    updateCounter();
                });
                statsObserver.unobserve(entry.target); // إيقاف المراقبة بعد العد
            }
        });
    }, { threshold: 0.5 }); // يبدأ العد عندما يكون 50% من القسم مرئياً

    const statsSection = document.getElementById('stats');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }
});