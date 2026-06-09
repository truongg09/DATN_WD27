function openRTMEGAmobile() {
    document.querySelector('.enabled-mobile-menu .mobile-menu-area').classList.add('opened');
    event.preventDefault();
}

function closeRTMEGAmobile() {
    document.querySelector('.enabled-mobile-menu .mobile-menu-area').classList.remove('opened');
    event.preventDefault();
}


(function ($) {

    RTmegaMenu = {
        init: function () {
            this.enableAccordion();
            this.enableHeaderScript();
            $(document)
                .on('click.RTmegaMenu', '.rtmega-menu-vertical-expand-button-wrapper a', this.expandVerticalMenu)
                .on('click.RTmegaMenu', '.rtmega-menu-top-style-cls', this.closeRTMEGAmobile_top);
        },
        expandVerticalMenu: function (e) {
            e.preventDefault();
            let widgetID = $(this).attr('widget_id');
            $('.enabled-vertical-menu .vertical-expaned-menu-area' + '.' + widgetID + ' .rtmega-menu-vertical-expanded').toggleClass('opened');
            if ($('.expand-position-top').length) {
                $('.rtmega-menu-top-style-cls').addClass("top-opened");
            }
        },
        enableAccordion: function ($scope) {
            var $selector = $(".rtmega-menu-area .mobile-menu-area .rtmega-menu-mobile-sidebar .rtmega-megamenu, .rtmega-menu-area .rtmega-megamenu.vertical.vertical-submenu-expand-mode-click");
            if ($scope) {
                $selector = $scope.find(".rtmega-menu-area .mobile-menu-area .rtmega-menu-mobile-sidebar .rtmega-megamenu, .rtmega-menu-area .rtmega-megamenu.vertical.vertical-submenu-expand-mode-click");
            }
            // Prevent double initialization
            $selector = $selector.not('.mg-accordion');
            if ($selector.length) {
                $selector.mgaccordion({
                    theme: 'tree',
                });
            }
        },
        closeRTMEGAmobile_top: function (e) {
            e.preventDefault();
            if ($('.expand-position-top').length) {
                $('.rtmega-menu-top-style-cls').removeClass("top-opened");
                $('.rtmega-menu-vertical-expanded.expand-position-top').removeClass("opened");
            }
        },
        enableHeaderScript: function () {
            let headerInnerWidth = $('.header-inner .e-con > .e-con-inner').width();
            $('.sub-menu.rtmegamenu-contents.full-width-mega-menu').css('width', headerInnerWidth + 'px');
            $('.sub-menu.rtmegamenu-contents.full-width-mega-menu').css('max-width', headerInnerWidth + 'px');
            $('.elementor-widget.elementor-widget-rt-mega-navigation-menu').css('position', 'static');
            $('.elementor-widget.elementor-widget-rt-mega-navigation-menu').parent().css('position', 'static');

            $(window).resize(function () {
                let headerInnerWidth = $('.header-inner .e-con > .e-con-inner').width();
                $('.sub-menu.rtmegamenu-contents.full-width-mega-menu').css('width', headerInnerWidth + 'px');
                $('.sub-menu.rtmegamenu-contents.full-width-mega-menu').css('max-width', headerInnerWidth + 'px');
            });
        }
    };

    RTmegaMenu.init();

    // vertical-submenu-expand-mode-hover mobile device click to sub menu open
    const $menu = $('.rtmega-menu-area .rtmega-megamenu.vertical.vertical-submenu-expand-mode-hover');
    if ($menu.length) {
        const RTMEGhoverExpandClassAdd = () => {
            $menu.toggleClass('rtmega-expand-hover-submenu-open-click', window.innerWidth <= 1024);
            if ($menu.hasClass('rtmega-expand-hover-submenu-open-click')) {
                $menu.mgaccordion({ theme: 'tree' });
            }
        };
        $(window).on('load resize', RTMEGhoverExpandClassAdd);
    }


    $(window).on('elementor/frontend/init', function () {
        elementorFrontend.hooks.addAction('frontend/element_ready/rt-mega-navigation-menu.default', function ($scope) {
            RTmegaMenu.enableAccordion($scope);
            RTmegaMenu.enableHeaderScript();

            // Re-apply vertical menu hover logic if needed
            const $menu = $scope.find('.rtmega-menu-area .rtmega-megamenu.vertical.vertical-submenu-expand-mode-hover');
            if ($menu.length) {
                const RTMEGhoverExpandClassAdd = () => {
                    $menu.toggleClass('rtmega-expand-hover-submenu-open-click', window.innerWidth <= 1024);
                    if ($menu.hasClass('rtmega-expand-hover-submenu-open-click')) {
                        $menu.mgaccordion({ theme: 'tree' });
                    }
                };
                RTMEGhoverExpandClassAdd();
                $(window).on('resize', RTMEGhoverExpandClassAdd);
            }
        });
    });

})(jQuery);