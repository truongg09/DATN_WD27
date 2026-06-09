(function ($) {

    let ESHBPUBLIC = {
        init: function () {
            ESHBPUBLIC.enableEshbGalleyCarousel();
            ESHBPUBLIC.enableEshbGridAnimation();
        },
        enableEshbGalleyCarousel: function () {

            let slidesPerView = $('.eshb_accomodation-template-default .eshb-accomodation-gallery-section .has-accomodation-gallery').attr('data-slides-per-view');

            const swiper = new Swiper('.eshb_accomodation-template-default .eshb-accomodation-gallery-section .has-accomodation-gallery', {
                loop: true,
                slidesPerView: slidesPerView,
                spaceBetween: 0,
                centeredSlides: true,
                // Navigation arrows
                navigation: {
                    nextEl: '.accomodation-gallery .swiper-button-next',
                    prevEl: '.accomodation-gallery .swiper-button-prev',
                },
                breakpoints: {
                    0: {
                        slidesPerView: 1,
                    },
                    360: {
                        slidesPerView: 1,
                    },
                    375: {
                        slidesPerView: 1,
                    },
                    480: {
                        slidesPerView: 1,
                    },
                    520: {
                        slidesPerView: 1,
                    },
                    640: {
                        slidesPerView: 1,
                    },
                    768: {
                        slidesPerView: 1,
                    },
                    1024: {
                        slidesPerView: 2,
                    },
                    1600: {
                        slidesPerView: slidesPerView,
                    },
                },
            });
        },
        enableEshbGridAnimation: function () {
            $('.eshb-item-grid .grid-item.has-animation-fade-in-up').each(function (index, element) {

                var delay = parseFloat(3) + parseFloat(index);

                $(element).css('animation-delay', '0.' + delay + 's');

            });
        },

    }

    ESHBPUBLIC.init();

})(jQuery);