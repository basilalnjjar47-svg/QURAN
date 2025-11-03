function openLoginDialog(role) {
    const dialog = document.getElementById('loginDialog');
    dialog.classList.add('visible');
}

function closeLoginDialog() {
    const dialog = document.getElementById('loginDialog');
    dialog.classList.remove('visible');
}

const loginForm = document.getElementById('loginFormInDialog');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const userId = document.getElementById('dialogUserId').value;
        const password = document.getElementById('dialogPassword').value;
        const loginError = document.getElementById('dialogLoginError');
        loginError.style.display = 'none';

        try {
            // تم تحديث الرابط بعنوان الخادم الحقيقي على Render
            const SERVER_URL = 'https://quran-32vn.onrender.com';
            const response = await fetch(`${SERVER_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, password: password }) // تم حذف الدور، الخادم سيحدده
            });

            const result = await response.json();

            if (!response.ok) {
                loginError.textContent = result.message || 'فشل تسجيل الدخول.';
                loginError.style.display = 'block';
                return;
            }

            // حفظ بيانات المستخدم الحقيقية
            sessionStorage.setItem('currentUser', JSON.stringify(result.user));

            // التوجيه للصفحة المناسبة
            const transitionOverlay = document.querySelector('.page-transition-overlay');
            transitionOverlay.classList.add('active');
            setTimeout(() => {
                window.location.href = result.redirectTo;
            }, 500);

        } catch (error) {
            loginError.textContent = 'لا يمكن الاتصال بالخادم. الرجاء المحاولة لاحقاً.';
            loginError.style.display = 'block';
        }
    });
}

document.getElementById('loginDialog')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeLoginDialog();
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