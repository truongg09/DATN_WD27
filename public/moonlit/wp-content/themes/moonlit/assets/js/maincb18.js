(function($) {
    "use strict";

    $(document).ready(function(){
        $(".menu-button, .close-button").on('click', function() {
            event.preventDefault();
            $(".nav-toggle, .menu-ofcn, .close-button, body").toggleClass("off-open");
        }); 
         
        $( "ul.children" ).addClass( "sub-menu" );
    });
	
	if (typeof elementorFrontend !== 'undefined') {
		if ($('.menu-area, .sidenav .menu').length) {
			document.addEventListener("DOMContentLoaded", function () {
				const menuItems = document.querySelectorAll('.menu-item-has-children > a');
				menuItems.forEach(item => {
					item.addEventListener('click', function (e) {
						e.preventDefault();
						const subMenu = this.nextElementSibling;

						if (subMenu && subMenu.classList.contains('sub-menu')) {
							if (subMenu.style.maxHeight) {
							  subMenu.style.maxHeight = null;
							  subMenu.style.opacity = '0';
							  this.classList.remove('rt-open');
							  subMenu.classList.remove('sub-open');
							} else {
							  subMenu.style.maxHeight = subMenu.scrollHeight + 'px';
							  subMenu.style.opacity = '1';
							  this.classList.add('rt-open');
							  subMenu.classList.add('sub-open');
							}
						}
					});
				});
			});
		}
	}


    if ($('.rt-bg-video-container').length) {
        document.addEventListener("DOMContentLoaded", function () {
            const videoContainer = document.querySelector(".rt-bg-video-container");
            const video = document.querySelector(".rt-bg-video");
            const playButton = document.querySelector(".rt-play-button");
            
            if (video && playButton) {
                playButton.addEventListener("click", function () {
                    videoContainer.style.backgroundImage = "none";
                    video.style.display = "block";
                    video.play();
                    playButton.style.display = "none";
                });

                video.addEventListener("click", function () {
                    if (video.paused) {
                        video.play();
                        playButton.style.display = "none";
                    } else {
                        video.pause();
                        playButton.style.display = "flex";
                    }
                });
            }
        });
    }


    var win=$(window);
    var totop = $('#top-to-bottom');    
    win.on('scroll', function() {
        if (win.scrollTop() > 150) {
            totop.fadeIn();
            $('.rts_header__switch').addClass('btt__enable');
            $('#top-to-bottom').addClass('scroll_visible');  
        } else {
            totop.slideDown(400);
            $('.rts_header__switch').removeClass('btt__enable');
            $('#top-to-bottom').removeClass('scroll_visible');
            
        }
    });

    if ($('#rt--preloader').length) {
        $(window).on('load', function() {   
            $("#rt--preloader").delay(300).fadeOut(100);  
        });
    }

    totop.on('click', function() {
        $("html,body").animate({
            scrollTop: 0
        }, 500)
    }); 
  
})(jQuery);