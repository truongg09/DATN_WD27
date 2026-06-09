(function ($) {

	$.fn.mgaccordion = function (options) {

		var defaults = {
			theme: "flat",
			leaveOpen: false
		};

		var settings = $.extend({}, defaults, options);

		var openIcon, closeIcon;

		this.initialize = function () {
			/**
			 * silently exit if passed element is not a list
			 */
			if (!this.is('ul') && !this.is('ol')) {
				console.log('Element is not a list');
				return;
			}
			this.addClass('mg-accordion');
			var theme = settings.theme;
			var leaveOpen = settings.leaveOpen;
			if (theme === 'tree') {
				this.addClass('mg-tree');
			} else {
				this.addClass('mg-flat');
			}
			
			$.each(this.find('li'), function () {
				var $li = $(this);
				var $a = $li.children('a');
				var $icon = $a.find('.submenu-parent-icon');
			
				if ($li.children('ul').length) {
					$li.addClass('dropdown');
					$li.find('ul').addClass('submenu');
			
					var href = $a.attr('href');
			
					if (typeof href === 'undefined' || href === '' || href === '#') {
						// No valid URL — allow entire <a> click
						$a.on('click', function (e) {
							e.preventDefault();
							if (leaveOpen === false) {
								closeOther($(this));
							}
							$(this).siblings('ul.submenu').slideToggle(function () {
								$(this).toggleClass('closed', $(this).is(':visible'));
							});
							updateIcons($(this));
						});
					} else {
						// Has a valid URL — allow only .submenu-parent-icon to toggle dropdown
						$icon.on('click', function (e) {
							e.preventDefault();
							e.stopPropagation();
							if (leaveOpen === false) {
								closeOther($a);
							}
							$a.siblings('ul.submenu').slideToggle(function () {
								$(this).toggleClass('closed', $(this).is(':visible'));
							});
							updateIcons($a);
						});
					}
				}
			});
			
			

			return this;

		};

		var setIcons = function () {
			if (settings.theme === 'tree') {
				openIcon = '<span class="toggler"><i class="fa fa-plus-circle"></i> </span>';
				closeIcon = '<span class="toggler"><i class="fa fa-minus-circle"></i> </span>';
			} else if (settings.theme === 'flat') {
				openIcon = '<span class="toggler"><i class="fa fa-arrow-circle-down"></i> </span>';
				closeIcon = '<span class="toggler"> <i class="fa fa-arrow-circle-up"></i></span>';
			}
		}

		var closeOther = function (obj) {
			setIcons();
			var items = obj.parent().siblings().find('ul.submenu');
			if (settings.theme === 'flat') {
				items.each(function () {
					if ($(this).hasClass('closed')) {
						$(this).slideUp('slow')
							.parent()
							.find('a')
							.removeClass('openItem');
					}
				});
			} else {
				items.each(function () {
					if ($(this).hasClass('closed')) {
						$(this).slideUp('slow')
							.parent()
							.find('span.toggler')
							.replaceWith(openIcon);
					}
				});
			}
		}

		var updateIcons = function (obj) {
			if (settings.theme === 'flat') {
				if (obj.siblings('.submenu').hasClass('closed')) {
					obj.removeClass('openItem');
				} else {
					obj.addClass('openItem');
				}
			} else {
				if (obj.siblings('.submenu').hasClass('closed')) {
					obj.find('span.toggler').replaceWith(openIcon);
				} else {
					obj.find('span.toggler').replaceWith(closeIcon);
				}
			}
		}

		return this.initialize();

	};

}(jQuery));
