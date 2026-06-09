(function($) {

    let ESHBDEPOSITADMIN = {
        init: function () { 
            this.bindEvents();

            // $( document )
            // .on( 'click.ESHBDEPOSITADMIN', '.easy-hotel-deposit-settings .eshb-activate-license', this.activateESHBLicense )
    
            // ;
        },
        bindEvents: function () { 
           
            $(document).ready(function () {

            //   setTimeout(() => {
            //     $('.wc-block-components-totals-footer-item').css('backgroundColor', 'gray');
            //     $('.wc-block-components-totals-fees__').css('display', 'none');
            //   }, 2000);


            });
            

            $(document.body).on('updated_checkout', function() {
                console.log('Checkout updated!');
                // Custom code here
            });

        }
        
    }

    ESHBDEPOSITADMIN.init();
    
})(jQuery);