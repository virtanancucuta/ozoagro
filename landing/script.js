/* OZOAGRO — Gallery + presentation selector + COD modal */
document.addEventListener("DOMContentLoaded", () => {
  const mainImage = document.getElementById("mainProductImage");
  const thumbs = Array.from(document.querySelectorAll(".thumb"));
  const prevBtn = document.getElementById("galleryPrev");
  const nextBtn = document.getElementById("galleryNext");
  const dotsWrap = document.getElementById("galleryDots");
  const cards = Array.from(document.querySelectorAll(".presentation-card"));

  const isMobile = () => window.matchMedia("(max-width: 820px)").matches;
  let currentIndex = 0;
  let galleryTimer = null;
  let selectedProduct = {
    product: "Galón (4 L)",
    price: "$409.900",
    image: "images/4l.png"
  };

  /* ---------- Lucide ---------- */
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }
  refreshIcons();

  /* ---------- Gallery ---------- */
  thumbs.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = "gallery-dot" + (index === 0 ? " active" : "");
    dotsWrap?.appendChild(dot);
  });

  function visibleCount() { return isMobile() ? 3 : 4; }

  function updateGallery(index, resetTimer = true) {
    if (!thumbs.length || !mainImage) return;
    currentIndex = (index + thumbs.length) % thumbs.length;
    const count = Math.min(visibleCount(), thumbs.length);
    const maxStart = Math.max(thumbs.length - count, 0);
    const start = Math.min(Math.max(currentIndex - Math.floor(count / 2), 0), maxStart);

    mainImage.src = thumbs[currentIndex].dataset.image;
    thumbs.forEach((thumb, i) => {
      const visible = i >= start && i < start + count;
      thumb.classList.toggle("is-visible", visible);
      thumb.classList.toggle("active", i === currentIndex);
      thumb.setAttribute("aria-current", i === currentIndex ? "true" : "false");
    });

    const dots = Array.from(dotsWrap?.querySelectorAll(".gallery-dot") || []);
    dots.forEach((dot, i) => dot.classList.toggle("active", i === currentIndex));
    if (resetTimer) restartGalleryTimer();
  }

  function restartGalleryTimer() {
    clearInterval(galleryTimer);
    galleryTimer = setInterval(() => updateGallery(currentIndex + 1, false), 5000);
  }

  thumbs.forEach((thumb, index) => thumb.addEventListener("click", () => updateGallery(index)));
  prevBtn?.addEventListener("click", () => updateGallery(currentIndex - 1));
  nextBtn?.addEventListener("click", () => updateGallery(currentIndex + 1));
  document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(galleryTimer) : restartGalleryTimer());
  window.addEventListener("resize", () => updateGallery(currentIndex, false));
  updateGallery(0, false);
  restartGalleryTimer();

  /* ---------- Presentation selector ---------- */
  function ensureChecks() {
    cards.forEach(card => {
      let check = card.querySelector(".selection-check");
      if (!check) {
        check = document.createElement("span");
        check.className = "selection-check";
        check.setAttribute("aria-hidden", "true");
        check.innerHTML = '<i data-lucide="check"></i>';
        card.appendChild(check);
      } else if (!check.querySelector("svg") && !check.querySelector("[data-lucide]")) {
        check.innerHTML = '<i data-lucide="check"></i>';
      }
    });
    refreshIcons();
  }

  function setSelectedCard(card) {
    if (!card) return;
    cards.forEach(item => {
      const selected = item === card;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    selectedProduct = {
      product: card.dataset.product || "",
      price: card.dataset.price || "",
      image: card.dataset.image || card.querySelector("img")?.getAttribute("src") || ""
    };
    syncModal(selectedProduct);
  }

  cards.forEach(card => {
    card.addEventListener("click", () => setSelectedCard(card));
  });

  ensureChecks();
  const initialCard = cards.find(card => card.dataset.product === selectedProduct.product) || cards[0];
  /* ---------- COD modal ---------- */
  const modal = document.getElementById("codModal");
  const closeBtn = document.getElementById("closeCodModal");
  const modalVariant = document.getElementById("modalVariant");
  const modalProductName = document.getElementById("modalProductName");
  const modalProductPrice = document.getElementById("modalProductPrice");
  const modalProductImage = document.getElementById("modalProductImage");
  const modalTotal = document.getElementById("modalTotal");
  const form = document.getElementById("orderForm");
  const formMessage = document.getElementById("formMessage");

  function syncModal(product) {
    if (!modalProductName) return;
    modalProductName.textContent = product.product;
    modalProductPrice.textContent = product.price;
    modalTotal.textContent = product.price;
    modalProductImage.src = product.image;
    const option = Array.from(modalVariant.options).find(o => o.value === product.product);
    if (option) modalVariant.value = option.value;
  }

  setSelectedCard(initialCard);

  function openModal() {
    syncModal(selectedProduct);
    modal?.classList.add("open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    refreshIcons();
    setTimeout(() => document.getElementById("nombre")?.focus(), 120);
  }

  function closeModal() {
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  [document.getElementById("mainOrderBtn"), document.getElementById("stickyOrderBtn")]
    .filter(Boolean)
    .forEach(button => button.addEventListener("click", openModal));
  closeBtn?.addEventListener("click", closeModal);
  modal?.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && modal?.classList.contains("open")) closeModal(); });

  modalVariant?.addEventListener("change", () => {
    const option = modalVariant.options[modalVariant.selectedIndex];
    selectedProduct = { product: option.value, price: option.dataset.price, image: option.dataset.image };
    const card = cards.find(c => c.dataset.product === selectedProduct.product);
    if (card) setSelectedCard(card);
    syncModal(selectedProduct);
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const selected = modalVariant.options[modalVariant.selectedIndex];
    const order = {
      product: selected.value, price: selected.dataset.price,
      nombre: data.get("nombre"), apellido: data.get("apellido"),
      telefono: data.get("telefono"), email: data.get("email"),
      departamento: data.get("departamento"), ciudad: data.get("ciudad"),
      direccion: data.get("direccion"), barrio: data.get("barrio"),
      indicaciones: data.get("indicaciones")
    };
    if (typeof window.ozoagroEnviarPedido === "function") { window.ozoagroEnviarPedido(order, form); return; }
    if (formMessage) formMessage.textContent = "No pudimos conectar el pedido. Escríbenos por WhatsApp.";
  });

  /* ---------- Sticky CTA: never visible on initial load ---------- */
  const stickyBar = document.getElementById("stickyOrderBar");
  const originalOrderButton = document.getElementById("mainOrderBtn");
  let originalCtaWasSeen = false;
  let userHasScrolled = false;

  function setStickyVisible(visible) {
    if (!stickyBar) return;
    stickyBar.classList.toggle("is-visible", visible);
    stickyBar.setAttribute("aria-hidden", visible ? "false" : "true");
    document.body.classList.toggle("sticky-visible", visible);
  }

  window.addEventListener("scroll", () => {
    userHasScrolled = window.scrollY > 40;
    if (!originalOrderButton || !stickyBar || !userHasScrolled) return;
    const rect = originalOrderButton.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (visible) {
      originalCtaWasSeen = true;
      setStickyVisible(false);
    } else if (originalCtaWasSeen && rect.bottom <= 0) {
      setStickyVisible(true);
    }
  }, { passive: true });

  setStickyVisible(false);
});

/* =========================================================
   OZOAGRO — LIGHTBOX DE GALERÍA CON ZOOM + NAVEGACIÓN
   Añadido sin alterar el slider existente.
   ========================================================= */
(() => {
  const initLightbox = () => {
    const mainImage = document.getElementById("mainProductImage");
    const thumbs = Array.from(document.querySelectorAll(".thumb"));
    if (!mainImage || !thumbs.length || document.getElementById("productLightbox")) return;

    const lightbox = document.createElement("div");
    lightbox.id = "productLightbox";
    lightbox.className = "product-lightbox";
    lightbox.setAttribute("aria-hidden", "true");
    lightbox.innerHTML = `
      <div class="lightbox-backdrop" data-lightbox-close></div>
      <div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Vista ampliada del producto">
        <button class="lightbox-close" type="button" aria-label="Cerrar vista ampliada" data-lightbox-close>×</button>
        <button class="lightbox-nav lightbox-prev" type="button" aria-label="Imagen anterior"><i data-lucide="chevron-left"></i></button>
        <div class="lightbox-stage">
          <img class="lightbox-image" id="lightboxImage" src="" alt="">
          <div class="lightbox-zoom-hint">Desliza para explorar · rueda o botones para zoom</div>
        </div>
        <button class="lightbox-nav lightbox-next" type="button" aria-label="Imagen siguiente"><i data-lucide="chevron-right"></i></button>
        <div class="lightbox-controls" aria-label="Controles de zoom">
          <button type="button" class="lightbox-zoom-btn" data-zoom-out aria-label="Alejar"><i data-lucide="zoom-out"></i></button>
          <span class="lightbox-zoom-level" id="lightboxZoomLevel">100%</span>
          <button type="button" class="lightbox-zoom-btn" data-zoom-in aria-label="Acercar"><i data-lucide="zoom-in"></i></button>
          <button type="button" class="lightbox-zoom-btn" data-zoom-reset aria-label="Restablecer zoom"><i data-lucide="scan"></i></button>
        </div>
        <div class="lightbox-counter" id="lightboxCounter" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(lightbox);

    const image = lightbox.querySelector("#lightboxImage");
    const stage = lightbox.querySelector(".lightbox-stage");
    const prev = lightbox.querySelector(".lightbox-prev");
    const next = lightbox.querySelector(".lightbox-next");
    const zoomLevel = lightbox.querySelector("#lightboxZoomLevel");
    const counter = lightbox.querySelector("#lightboxCounter");

    let zoom = 1;
    let translateX = 0;
    let translateY = 0;
    let activeIndex = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startTranslateX = 0;
    let startTranslateY = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const minZoom = 1;
    const maxZoom = 4;
    const zoomStep = 0.5;

    const getImageSrc = index => thumbs[index]?.dataset.image || thumbs[index]?.querySelector("img")?.src || "";

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const updateTransform = () => {
      image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${zoom})`;
      zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
      image.classList.toggle("is-zoomed", zoom > 1);
    };

    const resetZoom = () => {
      zoom = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    };

    const setZoom = (value, focusX = 0, focusY = 0) => {
      const previousZoom = zoom;
      zoom = clamp(value, minZoom, maxZoom);
      if (zoom === 1) {
        translateX = 0;
        translateY = 0;
      } else if (previousZoom !== zoom) {
        const factor = (zoom / previousZoom) - 1;
        translateX -= focusX * factor;
        translateY -= focusY * factor;
      }
      updateTransform();
    };

    const showImage = (index, reset = true) => {
      activeIndex = (index + thumbs.length) % thumbs.length;
      image.src = getImageSrc(activeIndex);
      image.alt = thumbs[activeIndex]?.querySelector("img")?.alt || "Producto OZOAGRO";
      counter.textContent = `${activeIndex + 1} / ${thumbs.length}`;
      if (reset) resetZoom();
    };

    const open = index => {
      showImage(index, true);
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
      if (window.lucide?.createIcons) window.lucide.createIcons();
    };

    const close = () => {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lightbox-open");
      resetZoom();
    };

    const goTo = direction => showImage(activeIndex + direction, true);

    mainImage.addEventListener("click", () => {
      const index = thumbs.findIndex(thumb => thumb.classList.contains("active"));
      open(index >= 0 ? index : 0);
    });

    mainImage.setAttribute("role", "button");
    mainImage.setAttribute("tabindex", "0");
    mainImage.setAttribute("aria-label", "Abrir imagen del producto en vista ampliada");
    mainImage.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        mainImage.click();
      }
    });

    lightbox.querySelectorAll("[data-lightbox-close]").forEach(el => el.addEventListener("click", close));
    prev.addEventListener("click", () => goTo(-1));
    next.addEventListener("click", () => goTo(1));
    lightbox.querySelector("[data-zoom-in]").addEventListener("click", () => setZoom(zoom + zoomStep));
    lightbox.querySelector("[data-zoom-out]").addEventListener("click", () => setZoom(zoom - zoomStep));
    lightbox.querySelector("[data-zoom-reset]").addEventListener("click", resetZoom);

    stage.addEventListener("wheel", event => {
      if (!lightbox.classList.contains("is-open")) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const focusX = event.clientX - (rect.left + rect.width / 2);
      const focusY = event.clientY - (rect.top + rect.height / 2);
      setZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), focusX, focusY);
    }, { passive: false });

    image.addEventListener("dblclick", event => {
      event.preventDefault();
      if (zoom > 1) resetZoom();
      else {
        const rect = stage.getBoundingClientRect();
        setZoom(2, event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      }
    });

    stage.addEventListener("pointerdown", event => {
      if (event.pointerType === "touch") return;
      if (zoom <= 1) return;
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      startTranslateX = translateX;
      startTranslateY = translateY;
      image.setPointerCapture?.(event.pointerId);
    });

    stage.addEventListener("pointermove", event => {
      if (!isDragging) return;
      translateX = startTranslateX + (event.clientX - dragStartX);
      translateY = startTranslateY + (event.clientY - dragStartY);
      updateTransform();
    });

    stage.addEventListener("pointerup", event => {
      isDragging = false;
      image.releasePointerCapture?.(event.pointerId);
    });
    stage.addEventListener("pointercancel", () => { isDragging = false; });

    const touchDistance = touches => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    stage.addEventListener("touchstart", event => {
      if (event.touches.length === 1) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchStartTime = Date.now();
      } else if (event.touches.length === 2) {
        pinchStartDistance = touchDistance(event.touches);
        pinchStartZoom = zoom;
      }
    }, { passive: true });

    stage.addEventListener("touchmove", event => {
      if (event.touches.length !== 2 || !pinchStartDistance) return;
      event.preventDefault();
      const distance = touchDistance(event.touches);
      setZoom(pinchStartZoom * (distance / pinchStartDistance));
    }, { passive: false });

    stage.addEventListener("touchend", event => {
      if (event.touches.length === 0 && pinchStartDistance) pinchStartDistance = 0;

      /* En zoom 1, un deslizamiento horizontal cambia de imagen. */
      if (zoom === 1 && event.changedTouches.length === 1 && touchStartTime) {
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const elapsed = Date.now() - touchStartTime;
        if (elapsed < 600 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          goTo(dx < 0 ? 1 : -1);
        }
      }
      touchStartTime = 0;
    }, { passive: true });

    document.addEventListener("keydown", event => {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") goTo(-1);
      else if (event.key === "ArrowRight") goTo(1);
      else if (event.key === "+" || event.key === "=") setZoom(zoom + zoomStep);
      else if (event.key === "-") setZoom(zoom - zoomStep);
      else if (event.key === "0") resetZoom();
    });

    /* Inicializa sin interferir con el slider existente. */
    showImage(0, true);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLightbox, { once: true });
  } else {
    initLightbox();
  }


})();


/* =========================================================
   OZOAGRO — TESTIMONIOS EN VIDEO
   Mobile: slider horizontal
   Desktop: 7 testimonios visibles
   Click: abre video en modal y reproduce
   ========================================================= */

(() => {

  function initOzoagroTestimonials() {

    const section = document.querySelector(".testimonials-section");

    if (!section) return;

    const cards = Array.from(
      section.querySelectorAll(".testimonial-video-card")
    );

    if (!cards.length) return;

    /* =====================================================
       CREAR MODAL DE VIDEO
       ===================================================== */

    let modal = document.getElementById("testimonialVideoModal");

    if (!modal) {

      modal = document.createElement("div");

      modal.id = "testimonialVideoModal";
      modal.className = "testimonial-video-modal";
      modal.setAttribute("aria-hidden", "true");

      modal.innerHTML = `

        <div
          class="testimonial-modal-backdrop"
          data-testimonial-close
        ></div>

        <div
          class="testimonial-modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Testimonio de productor"
        >

          <button
            type="button"
            class="testimonial-modal-close"
            aria-label="Cerrar video"
            data-testimonial-close
          >
            ×
          </button>

          <div class="testimonial-modal-video-wrap">

            <video
              id="testimonialModalVideo"
              class="testimonial-modal-video"
              controls
              playsinline
              preload="metadata"
            ></video>

          </div>

        </div>
      `;

      document.body.appendChild(modal);
    }


    /* =====================================================
       REFERENCIAS
       ===================================================== */

    const video = modal.querySelector("#testimonialModalVideo");

    if (!video) return;


    /* =====================================================
       ABRIR VIDEO
       ===================================================== */

    function openTestimonial(card) {

      const videoSrc =
        card.dataset.video ||
        card.getAttribute("data-video-src");

      if (!videoSrc) {
        console.warn(
          "OZOAGRO: Esta tarjeta no tiene data-video."
        );
        return;
      }

      /*
       * Detener cualquier video anterior
       */

      video.pause();

      /*
       * Cargar nuevo video
       */

      video.src = videoSrc;
      video.load();

      /*
       * Mostrar modal
       */

      modal.classList.add("is-open");

      modal.setAttribute(
        "aria-hidden",
        "false"
      );

      document.body.classList.add(
        "testimonial-modal-open"
      );

      /*
       * Intentar reproducir automáticamente
       */

      const playPromise = video.play();

      if (playPromise !== undefined) {

        playPromise.catch(() => {
          /*
           * Algunos navegadores pueden bloquear
           * autoplay. El usuario podrá pulsar Play.
           */
        });

      }

    }


    /* =====================================================
       CERRAR VIDEO
       ===================================================== */

    function closeTestimonial() {

      video.pause();

      video.removeAttribute("src");

      video.load();

      modal.classList.remove("is-open");

      modal.setAttribute(
        "aria-hidden",
        "true"
      );

      document.body.classList.remove(
        "testimonial-modal-open"
      );

    }


    /* =====================================================
       CLICK EN TARJETAS
       ===================================================== */

    cards.forEach((card) => {

      card.setAttribute(
        "role",
        "button"
      );

      card.setAttribute(
        "tabindex",
        "0"
      );

      card.addEventListener(
        "click",
        () => openTestimonial(card)
      );


      /*
       * Accesibilidad:
       * Enter o espacio también abre el video.
       */

      card.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key === "Enter" ||
            event.key === " "
          ) {

            event.preventDefault();

            openTestimonial(card);

          }

        }
      );

    });


    /* =====================================================
       BOTONES / FONDO PARA CERRAR
       ===================================================== */

    modal
      .querySelectorAll("[data-testimonial-close]")
      .forEach((element) => {

        element.addEventListener(
          "click",
          closeTestimonial
        );

      });


    /* =====================================================
       ESC PARA CERRAR
       ===================================================== */

    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Escape" &&
          modal.classList.contains("is-open")
        ) {

          closeTestimonial();

        }

      }
    );


    /* =====================================================
       EVITAR CLIC DEL VIDEO CIERRE MODAL
       ===================================================== */

    const dialog =
      modal.querySelector(
        ".testimonial-modal-dialog"
      );

    dialog?.addEventListener(
      "click",
      (event) => {

        event.stopPropagation();

      }
    );


    /* =====================================================
       SWIPE MOBILE
       No necesitamos JavaScript para mover el slider.
       El CSS manejará el scroll horizontal.
       Este bloque únicamente mejora la experiencia.
       ===================================================== */

    const slider =
      section.querySelector(
        ".testimonials-track"
      );

    if (slider) {

      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      slider.addEventListener(
        "pointerdown",
        (event) => {

          if (
            event.pointerType === "mouse" &&
            event.button !== 0
          ) return;

          isDown = true;

          startX = event.clientX;

          scrollLeft = slider.scrollLeft;

        }
      );


      slider.addEventListener(
        "pointermove",
        (event) => {

          if (!isDown) return;

          /*
           * En móvil dejamos que el navegador
           * maneje el desplazamiento táctil.
           */

          if (
            event.pointerType === "touch"
          ) return;

          const distance =
            event.clientX - startX;

          slider.scrollLeft =
            scrollLeft - distance;

        }
      );


      const stopDragging = () => {

        isDown = false;

      };

      slider.addEventListener(
        "pointerup",
        stopDragging
      );

      slider.addEventListener(
        "pointercancel",
        stopDragging
      );

      slider.addEventListener(
        "pointerleave",
        stopDragging
      );

    }


    /* =====================================================
       VISIBILITY API
       Si el usuario cambia de pestaña,
       detener el video.
       ===================================================== */

    document.addEventListener(
      "visibilitychange",
      () => {

        if (
          document.hidden &&
          modal.classList.contains("is-open")
        ) {

          video.pause();

        }

      }
    );

  }


  /* =======================================================
     INICIALIZACIÓN SEGURA
     ======================================================= */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initOzoagroTestimonials,
      { once: true }
    );

  } else {

    initOzoagroTestimonials();

  }

})();


  /*  =========================================================
     CONTADOR ANIMADO
     ========================================================= */


document.addEventListener("DOMContentLoaded", function () {

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  const section = document.querySelector(".yield-section");
  const counters = document.querySelectorAll(".yield-number");

  if (!section || !counters.length) return;


  let animationRunning = false;
  let sectionVisible = false;


  function formatNumber(number) {
    return number.toLocaleString("es-CO");
  }


  function animateCounters() {

    if (animationRunning || !sectionVisible) return;

    animationRunning = true;

    counters.forEach((counter, index) => {

      const target = Number(counter.dataset.target);
      const duration = 1500;
      const startTime = performance.now();

      function updateCounter(currentTime) {

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        /*
         * Ease Out:
         * comienza rápido y termina suavemente.
         */
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        const currentValue = Math.floor(
          easedProgress * target
        );

        counter.textContent = formatNumber(currentValue);

        if (progress < 1) {

          requestAnimationFrame(updateCounter);

        } else {

          counter.textContent = counter.dataset.format;

        }

      }

      /*
       * Pequeño retraso entre cada contador
       * para que la animación se vea más natural.
       */
      setTimeout(() => {
        requestAnimationFrame(updateCounter);
      }, index * 120);

    });


    setTimeout(() => {
      animationRunning = false;
    }, 1900);

  }


  /*
   * Detecta cuando la sección realmente entra
   * en el área visible de la pantalla.
   */
  const observer = new IntersectionObserver(
    function (entries) {

      entries.forEach(entry => {

        sectionVisible = entry.isIntersecting;

        if (sectionVisible) {
          animateCounters();
        }

      });

    },
    {
      threshold: 0.25
    }
  );


  observer.observe(section);


  /*
   * Repetición cada 12 segundos.
   * Solo anima si el usuario todavía
   * está viendo la sección.
   */
  setInterval(() => {

    if (sectionVisible) {
      animateCounters();
    }

  }, 12000);

});



/* =========================================================
   OZOAGRO — TESTIMONIOS EN VIDEO
   =========================================================
   • Miniatura tomada del propio video
   • Click para abrir y reproducir
   • Modal
   • Slider móvil
   • 7 videos en PC
   • Puntos del slider
   ========================================================= */

(function () {

  function initTestimonials() {

    const section = document.querySelector(".testimonials-section");

    if (!section) return;


    const cards = Array.from(
      section.querySelectorAll(".testimonial-card")
    );

    if (!cards.length) return;


    /* =====================================================
       MINIATURAS DE LOS VIDEOS
       ===================================================== */

    cards.forEach(function (card) {

      const videoSrc = card.getAttribute("data-video");

      const thumbnail = card.querySelector(
        ".testimonial-thumbnail-video"
      );

      if (!videoSrc || !thumbnail) return;


      /*
       * Cargar el video utilizado como miniatura
       */

      thumbnail.src = videoSrc;
      thumbnail.muted = true;
      thumbnail.playsInline = true;
      thumbnail.preload = "metadata";


      /*
       * Cuando conocemos la duración,
       * buscamos un fotograma aproximadamente
       * en el segundo 1.
       */

      thumbnail.addEventListener(
        "loadedmetadata",
        function () {

          let time = 1;

          if (
            thumbnail.duration &&
            thumbnail.duration < 1
          ) {
            time = thumbnail.duration * 0.5;
          }

          try {

            thumbnail.currentTime = time;

          } catch (error) {

            console.warn(
              "No se pudo generar la miniatura:",
              videoSrc
            );

          }

        }
      );


      /*
       * Pausar cuando llegue al fotograma elegido.
       */

      thumbnail.addEventListener(
        "seeked",
        function () {

          thumbnail.pause();

        },
        { once: true }
      );

    });


    /* =====================================================
       MODAL
       ===================================================== */

    let modal =
      document.getElementById("testimonialModal");


    /*
     * Si el modal ya existe en el HTML,
     * utilizamos ese.
     */

    if (!modal) {

      modal = document.createElement("div");

      modal.id = "testimonialModal";

      modal.className = "testimonial-modal";

      modal.setAttribute(
        "aria-hidden",
        "true"
      );

      modal.innerHTML = `

        <div class="testimonial-modal-overlay"></div>

        <div
          class="testimonial-modal-content"
          role="dialog"
          aria-modal="true"
        >

          <button
            type="button"
            class="testimonial-modal-close"
            aria-label="Cerrar video"
          >
            ×
          </button>

          <video
            class="testimonial-modal-video"
            controls
            playsinline
            preload="metadata"
          ></video>

        </div>

      `;

      document.body.appendChild(modal);

    }


    /* =====================================================
       ELEMENTOS DEL MODAL
       ===================================================== */

    const modalVideo =
      modal.querySelector("#testimonialVideo") ||
      modal.querySelector(".testimonial-modal-video");


    const closeButton =
      modal.querySelector("#testimonialClose") ||
      modal.querySelector(".testimonial-modal-close");


    const overlay =
      modal.querySelector(".testimonial-modal-overlay");


    if (!modalVideo) {

      console.warn(
        "OZOAGRO: No se encontró el video del modal."
      );

      return;

    }


    /* =====================================================
       ABRIR VIDEO
       ===================================================== */

    function openVideo(card) {

      const videoSrc =
        card.getAttribute("data-video");


      if (!videoSrc) {

        console.warn(
          "OZOAGRO: Falta data-video en una tarjeta."
        );

        return;

      }


      /*
       * Detener video anterior
       */

      modalVideo.pause();


      /*
       * Cargar el nuevo video
       */

      modalVideo.src = videoSrc;

      modalVideo.load();


      /*
       * Mostrar modal
       */

      modal.classList.add("is-open");

      modal.setAttribute(
        "aria-hidden",
        "false"
      );

      document.body.classList.add(
        "testimonial-modal-open"
      );


      /*
       * Reproducir automáticamente
       */

      modalVideo.play().catch(function () {

        /*
         * Si el navegador bloquea autoplay,
         * aparecerán los controles normales.
         */

      });

    }


    /* =====================================================
       CERRAR VIDEO
       ===================================================== */

    function closeVideo() {

      modalVideo.pause();

      modalVideo.removeAttribute("src");

      modalVideo.load();

      modal.classList.remove("is-open");

      modal.setAttribute(
        "aria-hidden",
        "true"
      );

      document.body.classList.remove(
        "testimonial-modal-open"
      );

    }


    /* =====================================================
       CLICK EN TARJETAS
       ===================================================== */

    cards.forEach(function (card) {

      card.style.cursor = "pointer";


      card.addEventListener(
        "click",
        function () {

          openVideo(card);

        }
      );


      /*
       * Accesibilidad
       */

      card.setAttribute(
        "tabindex",
        "0"
      );


      card.addEventListener(
        "keydown",
        function (event) {

          if (
            event.key === "Enter" ||
            event.key === " "
          ) {

            event.preventDefault();

            openVideo(card);

          }

        }
      );

    });


    /* =====================================================
       CERRAR MODAL
       ===================================================== */

    if (closeButton) {

      closeButton.addEventListener(
        "click",
        closeVideo
      );

    }


    if (overlay) {

      overlay.addEventListener(
        "click",
        closeVideo
      );

    }


    /* =====================================================
       ESC PARA CERRAR
       ===================================================== */

    document.addEventListener(
      "keydown",
      function (event) {

        if (
          event.key === "Escape" &&
          modal.classList.contains("is-open")
        ) {

          closeVideo();

        }

      }
    );


    /* =====================================================
       PAUSAR VIDEO SI SE CAMBIA DE PESTAÑA
       ===================================================== */

    document.addEventListener(
      "visibilitychange",
      function () {

        if (
          document.hidden &&
          modal.classList.contains("is-open")
        ) {

          modalVideo.pause();

        }

      }
    );


    /* =====================================================
       PUNTOS DEL SLIDER
       ===================================================== */

    const dotsContainer =
      section.querySelector("#testimonialDots");


    const slider =
      section.querySelector("#testimonialsSlider");


    if (
      dotsContainer &&
      slider
    ) {

      /*
       * Limpiar puntos existentes
       */

      dotsContainer.innerHTML = "";


      cards.forEach(function (card, index) {

        const dot =
          document.createElement("button");


        dot.type = "button";

        dot.className =
          "testimonial-dot";


        dot.setAttribute(
          "aria-label",
          "Ver testimonio " + (index + 1)
        );


        dot.addEventListener(
          "click",
          function () {

            card.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center"
            });

          }
        );


        dotsContainer.appendChild(dot);

      });


      const dots =
        Array.from(
          dotsContainer.querySelectorAll(
            ".testimonial-dot"
          )
        );


      /*
       * Primer punto activo
       */

      if (dots.length) {

        dots[0].classList.add(
          "is-active"
        );

      }


      /*
       * Detectar tarjeta visible
       */

      const sliderObserver =
        new IntersectionObserver(
          function (entries) {

            entries.forEach(
              function (entry) {

                if (
                  entry.isIntersecting
                ) {

                  const index =
                    cards.indexOf(
                      entry.target
                    );


                  if (
                    index >= 0 &&
                    dots[index]
                  ) {

                    dots.forEach(
                      function (dot) {

                        dot.classList.remove(
                          "is-active"
                        );

                      }
                    );


                    dots[index].classList.add(
                      "is-active"
                    );

                  }

                }

              }
            );

          },
          {
            root: slider,
            threshold: 0.6
          }
        );


      cards.forEach(function (card) {

        sliderObserver.observe(card);

      });

    }


    /* =====================================================
       DRAG CON MOUSE EN PC
       ===================================================== */

    if (slider) {

      let isDragging = false;

      let startX = 0;

      let initialScroll = 0;


      slider.addEventListener(
        "pointerdown",
        function (event) {

          if (
            event.pointerType === "mouse" &&
            event.button !== 0
          ) {

            return;

          }


          isDragging = true;

          startX = event.clientX;

          initialScroll =
            slider.scrollLeft;

        }
      );


      slider.addEventListener(
        "pointermove",
        function (event) {

          if (!isDragging) return;


          /*
           * Touch utiliza el comportamiento
           * nativo del navegador.
           */

          if (
            event.pointerType === "touch"
          ) {

            return;

          }


          const distance =
            event.clientX - startX;


          slider.scrollLeft =
            initialScroll - distance;

        }
      );


      function stopDragging() {

        isDragging = false;

      }


      slider.addEventListener(
        "pointerup",
        stopDragging
      );


      slider.addEventListener(
        "pointercancel",
        stopDragging
      );


      slider.addEventListener(
        "pointerleave",
        stopDragging
      );

    }

  }


  /* =======================================================
     INICIALIZAR
     ======================================================= */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initTestimonials,
      { once: true }
    );

  } else {

    initTestimonials();

  }

})();

/* =========================================================
   OZOAGRO — GALERÍA LATINOAMÉRICA
   ---------------------------------------------------------
   MOBILE:
   - 4 imágenes visibles: 2 x 2
   - 8 imágenes en total
   - Slider horizontal
   - Swipe con dedo
   - Flechas
   - Puntos

   DESKTOP:
   - Las 8 imágenes visibles
   - 4 x 2

   MODAL:
   - Clic sobre cualquier imagen
   - Imagen ampliada
   - País + bandera
   - Cierre por botón, fondo o ESC
   ========================================================= */

(function () {

  function initLatamGallery() {

    const section = document.querySelector(".latam-section");

    if (!section) return;


    /* =====================================================
       ELEMENTOS
       ===================================================== */

    const slider =
      section.querySelector("#latamSlider");

    const cards =
      Array.from(
        section.querySelectorAll(".latam-card")
      );

    const prev =
      section.querySelector(".latam-prev");

    const next =
      section.querySelector(".latam-next");

    const dotsContainer =
      section.querySelector("#latamDots");

    const modal =
      section.querySelector("#latamModal");

    const modalImage =
      section.querySelector("#latamModalImage");

    const modalCountry =
      section.querySelector("#latamModalCountry");

    const modalClose =
      section.querySelector("#latamModalClose");

    const modalOverlay =
      section.querySelector(".latam-modal-overlay");


    if (
      !slider ||
      !cards.length
    ) {
      console.warn(
        "OZOAGRO: No se encontró la estructura de la galería."
      );

      return;
    }


    /* =====================================================
       CONFIGURACIÓN
       ===================================================== */

    const MOBILE_BREAKPOINT = 767;

    const MOBILE_CARDS_PER_PAGE = 4;

    let currentPage = 0;

    let totalPages = 1;


    /* =====================================================
       CALCULAR PÁGINAS
       ===================================================== */

    function calculatePages() {

      if (
        window.innerWidth <= MOBILE_BREAKPOINT
      ) {

        totalPages =
          Math.ceil(
            cards.length /
            MOBILE_CARDS_PER_PAGE
          );

      } else {

        totalPages = 1;

      }


      if (
        currentPage >= totalPages
      ) {

        currentPage =
          totalPages - 1;

      }

    }


    /* =====================================================
       CREAR PUNTOS
       ===================================================== */

    function createDots() {

      if (!dotsContainer) return;

      dotsContainer.innerHTML = "";


      /*
       * En PC no mostramos puntos.
       */

      if (
        window.innerWidth > MOBILE_BREAKPOINT
      ) {

        return;

      }


      for (
        let i = 0;
        i < totalPages;
        i++
      ) {

        const dot =
          document.createElement("button");

        dot.type = "button";

        dot.className =
          "latam-dot";


        if (
          i === currentPage
        ) {

          dot.classList.add("active");

        }


        dot.setAttribute(
          "aria-label",
          "Mostrar grupo " + (i + 1)
        );


        dot.addEventListener(
          "click",
          function () {

            goToPage(i);

          }
        );


        dotsContainer.appendChild(dot);

      }

    }


    /* =====================================================
       ACTUALIZAR PUNTOS
       ===================================================== */

    function updateDots() {

      if (!dotsContainer) return;

      const dots =
        dotsContainer.querySelectorAll(
          ".latam-dot"
        );


      dots.forEach(
        function (dot, index) {

          dot.classList.toggle(
            "active",
            index === currentPage
          );

        }
      );

    }


    /* =====================================================
       IR A UNA PÁGINA
       ===================================================== */

    function goToPage(page) {

      if (
        window.innerWidth > MOBILE_BREAKPOINT
      ) {

        return;

      }


      currentPage =
        Math.max(
          0,
          Math.min(
            page,
            totalPages - 1
          )
        );


      /*
       * Cada página ocupa exactamente
       * el ancho visible del slider.
       */

      const targetLeft =
        currentPage *
        slider.clientWidth;


      slider.scrollTo({

        left: targetLeft,

        behavior: "smooth"

      });


      updateDots();

    }


    /* =====================================================
       FLECHA ANTERIOR
       ===================================================== */

    if (prev) {

      prev.addEventListener(
        "click",
        function (event) {

          event.preventDefault();

          if (
            window.innerWidth > MOBILE_BREAKPOINT
          ) {
            return;
          }


          goToPage(
            currentPage - 1
          );

        }
      );

    }


    /* =====================================================
       FLECHA SIGUIENTE
       ===================================================== */

    if (next) {

      next.addEventListener(
        "click",
        function (event) {

          event.preventDefault();

          if (
            window.innerWidth > MOBILE_BREAKPOINT
          ) {
            return;
          }


          goToPage(
            currentPage + 1
          );

        }
      );

    }


    /* =====================================================
       ACTUALIZAR PUNTOS AL DESLIZAR
       ===================================================== */

    slider.addEventListener(
      "scroll",
      function () {

        if (
          window.innerWidth > MOBILE_BREAKPOINT
        ) {

          return;

        }


        const pageWidth =
          slider.clientWidth;


        if (pageWidth <= 0) {
          return;
        }


        currentPage =
          Math.round(
            slider.scrollLeft /
            pageWidth
          );


        updateDots();

      },
      {
        passive: true
      }
    );


    /* =====================================================
       SWIPE / ARRASTRE
       ===================================================== */

    let pointerDown = false;

    let startX = 0;

    let startScrollLeft = 0;


    slider.addEventListener(
      "pointerdown",
      function (event) {

        if (
          window.innerWidth > MOBILE_BREAKPOINT
        ) {

          return;

        }


        pointerDown = true;

        startX =
          event.clientX;

        startScrollLeft =
          slider.scrollLeft;


        slider.setPointerCapture?.(
          event.pointerId
        );

      }
    );


    slider.addEventListener(
      "pointermove",
      function (event) {

        if (!pointerDown) {
          return;
        }


        const distance =
          event.clientX - startX;


        slider.scrollLeft =
          startScrollLeft - distance;

      }
    );


    function stopPointer(event) {

      if (!pointerDown) {
        return;
      }


      pointerDown = false;


      try {

        slider.releasePointerCapture?.(
          event.pointerId
        );

      } catch (error) {}


      /*
       * Ajustar automáticamente
       * a la página más cercana.
       */

      if (
        window.innerWidth <= MOBILE_BREAKPOINT
      ) {

        const pageWidth =
          slider.clientWidth;


        if (pageWidth > 0) {

          const nearestPage =
            Math.round(
              slider.scrollLeft /
              pageWidth
            );


          goToPage(
            nearestPage
          );

        }

      }

    }


    slider.addEventListener(
      "pointerup",
      stopPointer
    );

    slider.addEventListener(
      "pointercancel",
      stopPointer
    );


    /* =====================================================
       MODAL
       ===================================================== */

    function openModal(card) {

      if (
        !modal ||
        !modalImage
      ) {

        return;

      }


      const image =
        card.querySelector("img");


      if (!image) {
        return;
      }


      const country =
        card.dataset.country ||
        "";


      /*
       * Imagen
       */

      modalImage.src =
        image.src;


      modalImage.alt =
        image.alt ||
        "OZOAGRO en " + country;


      /*
       * País + bandera
       */

      const countryElement =
        card.querySelector(
          ".latam-country"
        );


      if (
        countryElement &&
        modalCountry
      ) {

        modalCountry.innerHTML =
          countryElement.innerHTML;

      } else if (modalCountry) {

        modalCountry.textContent =
          country;

      }


      /*
       * Mostrar modal
       */

      modal.classList.add(
        "is-open"
      );


      modal.setAttribute(
        "aria-hidden",
        "false"
      );


      document.body.classList.add(
        "latam-modal-open"
      );

    }


    /* =====================================================
       CERRAR MODAL
       ===================================================== */

    function closeModal() {

      if (!modal) {
        return;
      }


      modal.classList.remove(
        "is-open"
      );


      modal.setAttribute(
        "aria-hidden",
        "true"
      );


      document.body.classList.remove(
        "latam-modal-open"
      );


      /*
       * Limpiar imagen después
       */

      setTimeout(
        function () {

          if (
            !modal.classList.contains(
              "is-open"
            )
          ) {

            if (modalImage) {

              modalImage.src = "";

            }

          }

        },
        250
      );

    }


    /* =====================================================
       CLIC EN LAS IMÁGENES
       ===================================================== */

    cards.forEach(
      function (card) {

        card.addEventListener(
          "click",
          function (event) {

            /*
             * Si el usuario está arrastrando,
             * no abrir modal.
             */

            if (pointerDown) {
              return;
            }


            openModal(card);

          }
        );


        /*
         * Evitar que la imagen
         * sea arrastrada por el navegador.
         */

        const image =
          card.querySelector("img");


        if (image) {

          image.setAttribute(
            "draggable",
            "false"
          );

        }

      }
    );


    /* =====================================================
       CERRAR CON BOTÓN
       ===================================================== */

    if (modalClose) {

      modalClose.addEventListener(
        "click",
        function (event) {

          event.preventDefault();

          closeModal();

        }
      );

    }


    /* =====================================================
       CERRAR HACIENDO CLIC EN FONDO
       ===================================================== */

    if (modalOverlay) {

      modalOverlay.addEventListener(
        "click",
        function () {

          closeModal();

        }
      );

    }


    /* =====================================================
       ESC
       ===================================================== */

    document.addEventListener(
      "keydown",
      function (event) {

        if (
          event.key === "Escape" &&
          modal &&
          modal.classList.contains(
            "is-open"
          )
        ) {

          closeModal();

        }

      }
    );


    /* =====================================================
       EVITAR QUE EL CLIC DEL CONTENIDO
       CIERRE EL MODAL
       ===================================================== */

    const modalContent =
      section.querySelector(
        ".latam-modal-content"
      );


    if (modalContent) {

      modalContent.addEventListener(
        "click",
        function (event) {

          event.stopPropagation();

        }
      );

    }


    /* =====================================================
       RESPONSIVE
       ===================================================== */

    function refreshGallery() {

      calculatePages();

      createDots();

      updateDots();


      /*
       * En PC mostramos todo.
       */

      if (
        window.innerWidth > MOBILE_BREAKPOINT
      ) {

        slider.scrollLeft = 0;

      } else {

        /*
         * En móvil volvemos
         * a la página actual.
         */

        requestAnimationFrame(
          function () {

            slider.scrollLeft =
              currentPage *
              slider.clientWidth;

          }
        );

      }

    }


    window.addEventListener(
      "resize",
      refreshGallery
    );


    /* =====================================================
       INICIALIZAR
       ===================================================== */

    calculatePages();

    createDots();

    updateDots();

  }


  /* =======================================================
     INICIO SEGURO
     ======================================================= */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initLatamGallery,
      {
        once: true
      }
    );

  } else {

    initLatamGallery();

  }

})();


/* =========================================================
   OZOAGRO — ACORDEÓN DE POLÍTICAS
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  const policies =
    document.querySelectorAll(".ozo-policy");

  if (!policies.length) return;


  policies.forEach(function (policy) {

    const button =
      policy.querySelector(".ozo-policy-button");

    if (!button) return;


    button.addEventListener("click", function () {

      const currentlyOpen =
        policy.classList.contains("is-open");


      /* Cerrar todas */

      policies.forEach(function (item) {

        item.classList.remove("is-open");

        const itemButton =
          item.querySelector(".ozo-policy-button");

        if (itemButton) {

          itemButton.setAttribute(
            "aria-expanded",
            "false"
          );

        }

      });


      /* Abrir la seleccionada */

      if (!currentlyOpen) {

        policy.classList.add("is-open");

        button.setAttribute(
          "aria-expanded",
          "true"
        );

      }

    });

  });

});