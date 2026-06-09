(function($) {

    let ESHBREVIEWSPUBLIC = {
        init: function () { 
            this.bindEvents();
            //this.initStarRating();
        },
        bindEvents: function () {
            // Bind any other events here if needed
            $('label.eshb-star-rating').on('mouseenter', function() {
                $(this).addClass('hover');
                $(this).prevAll('label').addClass('hover');
            }).on('mouseleave', function() {
                $('label.eshb-star-rating').removeClass('hover');
            });
            
        
            $('label.eshb-star-rating').on('click', function (e) {
                e.preventDefault();
            
                let input = $(this).find('input[type="radio"]');
            
                const selectedValue = parseInt(input.val());
            
                const $ratingContainer = $(this).parent();
            
                // Remove existing selection styles
                $ratingContainer.find('label').removeClass('selected');
            
                // Add selection styles up to the clicked star
                $(this).addClass('selected');
                $(this).prevAll('label').addClass('selected');
            
                // ✅ Manually check the input
                input.prop('checked', true);
            });
            

          
            document.querySelectorAll('.eshb-rating-progress-bar').forEach(bar => {
                const width = bar.style.getPropertyValue('--width');
                setTimeout(() => {
                bar.style.width = width;
                }, 300);
            });
           

            $('a.comment-reply-link').click(function (e) { 
                e.preventDefault();
                $('.rating-picker-wrapper').hide();
            });

            
            $('a#cancel-comment-reply-link, #eshb-add-review-button').click(function (e) { 
                e.preventDefault();
                $('.rating-picker-wrapper').show();
            });
        },
        
    }

    ESHBREVIEWSPUBLIC.init();

})(jQuery);