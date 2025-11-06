/**
 * ملف مركزي للتعامل مع جميع روابط التنقل في المنصة.
 * يمنع السلوك الافتراضي للروابط ويقوم بالتوجيه باستخدام JavaScript
 * لضمان عمل التنقل بسلاسة في جميع الصفحات.
 */
document.addEventListener('DOMContentLoaded', function() {
    // استهداف جميع الروابط داخل أشرطة التنقل
    const navLinks = document.querySelectorAll('.student-nav .nav-item');

    navLinks.forEach(link => {
        const destination = link.getAttribute('data-page') || link.getAttribute('href');

        // تجاهل الروابط غير الصالحة أو الرابط النشط حالياً
        if (!destination || destination === '#' || link.classList.contains('active')) {
            return;
        }

        link.addEventListener('click', function(e) {
            e.preventDefault(); // منع السلوك الافتراضي للرابط
            if (link.classList.contains('logout')) {
                sessionStorage.removeItem('currentUser');
            }
            window.location.href = destination;
        });
    });
});