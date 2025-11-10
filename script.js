function openLoginDialog(role) { // أعدنا role مؤقتاً للتوافق مع الاستدعاء القديم
    const dialog = document.getElementById('loginDialog');
    dialog.classList.add('visible');
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

authForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    authError.style.display = 'none';
    const SERVER_URL = 'https://quran-32vn.onrender.com';

    const loginData = {
        id: document.getElementById('dialogUserId').value,
        password: document.getElementById('dialogPassword').value,
    };

    try {
        const response = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData)
        });
        const result = await response.json();

        // --- تصحيح: التحقق من طلب الدخول بخطوتين أولاً ---
        if (result.status === '2fa_required') {
            sessionStorage.setItem('tempUserId', result.userId); // حفظ الـ ID مؤقتاً
            window.location.href = `admin-super-verify.html`;
            return; // إيقاف التنفيذ والانتقال لصفحة التحقق
        }

        // إذا لم يكن طلباً بخطوتين، تحقق من وجود أخطاء أخرى
        if (!response.ok) {
            authError.textContent = result.message || 'حدث خطأ ما.';
            authError.style.display = 'block';
            return;
        }

        // في حالة تسجيل الدخول العادي الناجح
        sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        document.body.classList.add('is-transitioning');
        setTimeout(() => { window.location.href = result.redirectTo; }, 200);
    } catch (error) {
        authError.textContent = 'لا يمكن الاتصال بالخادم. الرجاء المحاولة لاحقاً.';
        authError.style.display = 'block';
    }
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
    // --- التصحيح: تم نقل كود التمرير إلى هنا لضمان عمله بعد تحميل الصفحة ---
    document.querySelectorAll('[data-scroll-to]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.dataset.scrollTo);
            if (target) {
                // إغلاق القائمة الجانبية في الهاتف قبل التمرير (تحسين إضافي)
                const mainNav = document.getElementById('mainNav');
                if (mainNav && mainNav.classList.contains('show')) {
                    bootstrap.Collapse.getInstance(mainNav).hide();
                }
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

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
        startSessionObserver.observe(statsSection);
    }
});

// --- جديد: تحسين تجربة القائمة الجانبية (Navbar) في الهاتف ---
document.addEventListener('DOMContentLoaded', function () {
    const mainNav = document.getElementById('mainNav');
    if (!mainNav) return;

    const bsCollapse = new bootstrap.Collapse(mainNav, { toggle: false });
    const navLinks = mainNav.querySelectorAll('.nav-link');

    // 1. إغلاق القائمة عند الضغط على أي رابط بداخلها
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mainNav.classList.contains('show')) {
                bsCollapse.hide();
            }
        });
    });

    // 2. إغلاق القائمة عند الضغط في أي مكان خارجها
    document.addEventListener('click', function (event) {
        const isClickInsideNav = mainNav.contains(event.target);
        const isToggler = event.target.closest('.navbar-toggler');

        if (!isClickInsideNav && !isToggler && mainNav.classList.contains('show')) {
            bsCollapse.hide();
        }
    });
});