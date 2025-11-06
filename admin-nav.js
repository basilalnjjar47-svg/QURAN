document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.student-nav .nav-item');

    navLinks.forEach(link => {
        const destination = link.getAttribute('data-page') || link.getAttribute('href');

        // تجاهل الروابط غير الصالحة أو الرابط النشط
        if (!destination || link.classList.contains('active')) {
            return;
        }

        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (link.classList.contains('logout')) {
                sessionStorage.removeItem('currentUser');
            }
            
            window.location.href = destination;
        });
    });
});