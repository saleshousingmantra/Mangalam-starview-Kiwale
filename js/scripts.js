document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById("header"),
        menuToggle = document.getElementById("menuToggle"),
        navLinks = document.getElementById("navLinks");
    const modal = document.getElementById("modal"),
        modalClose = document.getElementById("modalClose"),
        backTop = document.getElementById("backTop");

    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 40);
        backTop.classList.toggle("show", window.scrollY > 500);
    }, {
        passive: true
    });

    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("active");
        menuToggle.innerHTML = navLinks.classList.contains("active") ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }));

    const openModal = () => {
        modal.classList.add("active");
        document.body.style.overflow = "hidden"
    };
    const closeModal = () => {
        modal.classList.remove("active");
        document.body.style.overflow = ""
    };
    document.querySelectorAll(".open-modal").forEach(b => b.addEventListener("click", openModal));
    modalClose.addEventListener("click", closeModal);
    modal.addEventListener("click", e => {
        if (e.target === modal) closeModal()
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeModal()
    });

    window.addEventListener("load", () => {
        if (!sessionStorage.getItem("starview_popup_shown")) {
            setTimeout(() => {
                openModal();
                sessionStorage.setItem("starview_popup_shown", "1")
            }, 1800);
        }
    });

    backTop.addEventListener("click", () => window.scrollTo({
        top: 0,
        behavior: "smooth"
    }));

    
});