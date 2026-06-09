(function ($) {
  /**
   * ESHBPUBLICBOOKING
   * 
   * Main booking handler object for Easy Hotel Booking plugin.
   * Manages calendar initialization, booking form logic, availability, pricing, extra services, time slots, and event bindings.
   * 
   * @namespace ESHBPUBLICBOOKING
   * 
   * @property {function} init - Initializes booking form, calendar, events, and UI elements.
   * @property {function} eshbCalVars - Returns jQuery selectors and variables for booking form elements.
   * @property {function} clickTest - Test click handler for debugging.
   * @property {function} addElementsToBookingMetaboxes - Adds UI elements for room status and error messages.
   * @property {function} validateRoomQuantity - Validates room quantity input against max value.
   * @property {function} validateInputFields - Validates required fields before form submission.
   * @property {function} getCustomerDetailsFromMetabox - Extracts customer details from metabox form.
   * @property {function} bindEventsForAccomodationMetas - Binds change events for accommodation selection.
   * @property {object} calendarDefaultsOps - Default options for date range picker/calendar.
   * @property {function} isDatePrevious - Checks if a date is after yesterday (UTC).
   * @property {function} isDateBooked - Checks if a date is booked.
   * @property {function} isDateCheckIn - Checks if a date is a check-in date.
   * @property {function} isDateCheckOut - Checks if a date is a check-out date.
   * @property {function} isDateholiDay - Checks if a date is a holiday.
   * @property {function} isDisallowedDates - Checks if a date is not allowed for check-in.
   * @property {function} getPreviousDate - Returns previous date in YYYY-MM-DD format.
   * @property {function} updateEshbCalendar - Updates calendar and time slots based on selected dates.
   * @property {function} isBookingEditMode - Checks if booking is in edit mode (admin).
   * @property {function} getnextAllowedStartDate - Gets next allowed start date based on allowed days.
   * @property {function} hasBookedDatesInRange - Checks for booking conflicts in a date range.
   * @property {function} getNextAvailableStartDate - Finds next available start date after booked dates.
   * @property {function} checkInDayErrors - Handles errors for invalid check-in days.
   * @property {function} minMaxErr - Validates min/max nights for booking.
   * @property {function} resetCalendar - Resets calendar to default min nights and dates.
   * @property {function} setEshbFormCalendar - Initializes and configures calendar pickers.
   * @property {function} setBookingFormCalendar - Loads booking data and sets up calendar for selected accommodation.
   * @property {function} selectTimeSlot - Handles selection of time slots for hourly bookings.
   * @property {function} updateTimeSlotsHtml - Updates available time slots HTML via AJAX.
   * @property {function} triggerTimePicker - Triggers native time picker for input elements.
   * @property {function} convertTo12HourFormat - Converts 24-hour time to 12-hour format.
   * @property {function} validateTimePicker - Validates time picker input values.
   * @property {function} addHours - Adds or subtracts hours from a time string.
   * @property {function} renderTimeSlotsList - Renders available time slots in the UI.
   * @property {function} eshbNumberIncreament - Increments input value, respecting max count.
   * @property {function} eshbNumberDecreament - Decrements input value, respecting min count.
   * @property {function} eshbSearchQtyNumberIncreament - Increments search form quantity.
   * @property {function} updateAvailabilityNotice - Updates available room count notice.
   * @property {function} fetchAccomodationMeta - Fetches accommodation meta data via AJAX.
   * @property {function} eshbBookingQtyNumberIncreamentFrontEnd - Handles increment for frontend booking quantities.
   * @property {function} eshbBookingQtyNumberIncreamentAdmin - Handles increment for admin booking quantities.
   * @property {function} eshbBookingQtyNumberIncreament - Main increment logic for booking quantities.
   * @property {function} hideServiceQtyDropdown - Hides service quantity dropdown if clicked outside.
   * @property {function} showServiceQtyDropdown - Shows service quantity dropdown.
   * @property {function} getExtraServices - Gets selected extra services and their quantities.
   * @property {function} updatePricingTable - Updates pricing table based on current selections.
   * @property {function} formatPrice - Formats price with currency symbol.
   * @property {function} calculateExtraServicesPricing - Calculates extra services pricing and updates total.
   * @property {function} addToCartReservation - Handles reservation submission and cart logic.
   * @property {function} closeBookingFormModal - Closes booking modal dialog.
   * @property {function} openBookingFormModal - Opens booking modal dialog.
   * @property {function} countriesDataMount - Loads and mounts country/state/city data for admin forms.
   * @property {function} addCustomFieldsToShortcodedForm - Adds custom booking fields to shortcoded forms (CF7, FluentForm).
   * @property {function} updateCustomFieldsInShortcodedForm - Updates custom fields in shortcoded forms.
   */
  let ESHBPUBLICBOOKING = {
    init: function () {
      let eshbCalVars = ESHBPUBLICBOOKING.eshbCalVars();
      let startDateInput = eshbCalVars.startDateInput;
      let endDateInput = eshbCalVars.endDateInput;
      let availableDatePickerInput = eshbCalVars.availableDatePickerInput;
      let accomodationId = eshbCalVars.accomodationId;
      let form = eshbCalVars.bookingFormEl;
      let roomQuantityInput = eshbCalVars.roomQuantityInput;

      // initialize calendar
      ESHBPUBLICBOOKING.setEshbFormCalendar(
        startDateInput,
        endDateInput,
        availableDatePickerInput,
        roomQuantityInput,
        accomodationId,
        form,
        "",
        "",
        "",
        "",
        "",
        eshb_ajax.requiredMinNights,
        eshb_ajax.requiredMaxNights
      );

      // update & set as booking calendar
      ESHBPUBLICBOOKING.setBookingFormCalendar(
        startDateInput,
        endDateInput,
        availableDatePickerInput,
        roomQuantityInput,
        accomodationId,
        form
      );

      // add elements to booking metaboxes form
      ESHBPUBLICBOOKING.addElementsToBookingMetaboxes();

      // bind events for accomodation metaboxes
      ESHBPUBLICBOOKING.bindEventsForAccomodationMetas();

      // mount countries fields data from api
      ESHBPUBLICBOOKING.countriesDataMount();

      // validate input fields of metaboxes form
      ESHBPUBLICBOOKING.validateInputFields();

      // update checkbox checked attr for change services
      ESHBPUBLICBOOKING.updateServicesChecked();

      // add event listeners
      $(document)
        .on(
          "click.ESHBPUBLICBOOKING",
          '.eshb-booking-form .service-item input[name="extra_services[]"]',
          this.calculateExtraServicesPricing
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          '.eshb-booking-form input[name="service-quantity"]',
          this.calculateExtraServicesPricing
        )
        .on(
          "keyup.ESHBPUBLICBOOKING",
          "#eshb_booking_metaboxes .booking-requirement-extra-services-fields input",
          this.updatePricingTable
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          "#eshb_booking_metaboxes .booking-requirement-extra-services-fields .csf-cloneable-item",
          this.updatePricingTable
        )
        .on(
          "keyup.ESHBPUBLICBOOKING",
          '.eshb-booking-form input[name="room_quantity"]',
          this.validateRoomQuantity
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          '.eshb-booking-form input[name="room_quantity"], .eshb-booking-form input[name="extra_bed_quantity"], .eshb-booking-form input[name="adult_quantity"], .eshb-booking-form input[name="children_quantity"]',
          this.updatePricingTable
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          'input[name="eshb_booking_metaboxes[room_quantity]"], input[name="eshb_booking_metaboxes[extra_bed_quantity]"], input[name="eshb_booking_metaboxes[adult_quantity]"], input[name="eshb_booking_metaboxes[children_quantity]"]',
          this.updatePricingTable
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".eshb-booking-form .eshb-form-submit-btn",
          this.addToCartReservation
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".eshb-booking-form .service-quantity-selector",
          this.showServiceQtyDropdown
        )
        .on("click.ESHBPUBLICBOOKING", "", this.hideServiceQtyDropdown)
        .on(
          "click.ESHBPUBLICBOOKING",
          ".eshb-booking-form .d-plus",
          this.eshbBookingQtyNumberIncreamentFrontEnd
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".eshb-search-form .d-plus",
          this.eshbSearchQtyNumberIncreament
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".eshb-booking-form .d-minus",
          this.eshbBookingQtyNumberDecreamentFrontEnd
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".eshb-search-form .d-minus",
          this.eshbSearchQtyNumberDecreamentFrontEnd
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".easy-hotel-booking-modal-closer",
          this.closeBookingFormModal
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".easy-hotel-toggler-booking-form-modal",
          this.openBookingFormModal
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          '.eshb-booking-form input[name="start_date"], .eshb-booking-form input[name="end_date"]',
          this.updateEshbCalendar.bind(
            this,
            startDateInput,
            endDateInput,
            availableDatePickerInput,
            roomQuantityInput,
            accomodationId,
            form,
          )
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          ".eshb-booking-form input",
          this.updateCustomFieldsInShortcodedForm
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          "#eshb_booking_metaboxes .booking-requirement-input input",
          this.eshbBookingQtyNumberIncreamentAdmin
        )
        .on(
          "keydown.ESHBPUBLICBOOKING",
          "#eshb_booking_metaboxes .booking-requirement-input input",
          this.eshbBookingQtyNumberIncreamentAdmin
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".time-slots-wrapper input.time-slot",
          this.selectTimeSlot
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          ".time-slots-wrapper .eshb-time-slot",
          this.updatePricingTable
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          ".time-slots-wrapper .eshb-time-slot .booking-time-picker",
          this.updatePricingTable
        )
        .on(
          "click.ESHBPUBLICBOOKING",
          ".time-slots-wrapper .eshb-time-slot .booking-time-picker",
          (e) => {
            const inputEl = $(e.currentTarget)
              .parent(".eshb-time-wrapper")
              .find('input[type="time"]')
              .get(0);
            this.triggerTimePicker(inputEl);
          }
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          ".time-slots-wrapper .eshb-time-slot .booking-time-picker",
          this.validateTimePicker
        )
        .on(
          "change.ESHBPUBLICBOOKING",
          ".time-slots-wrapper .eshb-time-slot .booking-time-picker",
          this.updateAvailabilityNotice.bind(
            this,
            form,
            startDateInput,
            endDateInput,
            roomQuantityInput,
            accomodationId
          )
        );



    },
    eshbCalVars: function () {
      if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
        accomodationId = $(
          'select[name="eshb_booking_metaboxes[booking_accomodation_id]"]'
        ).val();
      } else {
        accomodationId = $('input[name="accomodation_id"]').val();
      }

      let vars = {
        bookingFormEl: $(
          "#eshb_booking_metaboxes, .eshb-booking-form, .eshb-search-form"
        ),
        startDateInput: $(
          '.eshb-booking-form input[name="start_date"], .eshb-search-form input[name="start_date"], input[name="eshb_booking_metaboxes[booking_start_date]"]'
        ),
        endDateInput: $(
          '.eshb-booking-form input[name="end_date"], .eshb-search-form input[name="end_date"], input[name="eshb_booking_metaboxes[booking_end_date]"]'
        ),
        startTimeInput: $(
          '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_start_time]"], .eshb-time-slot.selected input[name="start_time"]'
        ),
        endTimeInput: $(
          '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_end_time]"], .eshb-time-slot.selected input[name="end_time"]'
        ),
        availableDatePickerInput: $('input[name="available_date_picker"]'),
        adultQuantityInput: $(
          '.eshb-booking-form input[name="adult_quantity"], .eshb-search-form input[name="adult_quantity"], input[name="eshb_booking_metaboxes[adult_quantity]"]'
        ),
        childrenQuantityInput: $(
          '.eshb-booking-form input[name="children_quantity"], .eshb-search-form input[name="children_quantity"], input[name="eshb_booking_metaboxes[children_quantity]"]'
        ),
        roomQuantityInput: $(
          'input[name="room_quantity"], input[name="eshb_booking_metaboxes[room_quantity]"]'
        ),
        extraBedQuantityInput: $(
          'input[name="extra_bed_quantity"], input[name="eshb_booking_metaboxes[extra_bed_quantity]"]'
        ),
        accomodationId: accomodationId,
      };
      return vars;
    },
    clickTest: function (e) {
      e.preventDefault();
      console.log("clicked");
    },
    updateServicesChecked: function () {
      $('.eshb-booking-form .service-item input[name="extra_services[]"]').each(function (index, element) {
        $(element).on("change", function () {
          if ($(this).is(":checked")) {
            $(this).attr("checked", "checked");
          } else {
            $(this).removeAttr("checked");
          }
        });
      });
    },

    addElementsToBookingMetaboxes: function (param) {
      // add available room status field
      $(
        '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[room_quantity]"]'
      )
        .parent()
        .parent()
        .append(
          '<p class="capacity-status room-capacity-status">Available Rooms: <span class="room-capacity-number"></span></p>'
        );

      // add errors field
      $(
        "#eshb_booking_metaboxes .booking-requirement-input .csf-fieldset"
      ).append('<p class="err-msg"></p>');

      $(
        "#eshb_booking_metaboxes .booking-end-date-field .csf-fieldset"
      ).append('<p class="date-err-msg err-msg"></p>');
    },
    validateRoomQuantity: function () {
      let value = $(this).val();
      let max = $(this).attr("max");
      if (value > max) {
        $(this).val(max);
      }
    },
    validateInputFields: function () {

      $(
        "body.post-type-eshb_booking #publishing-action, body.post-type-eshb_payment #publishing-action, #publishing-action-booking-custom"
      ).click(function (e) {
        let isValid = true;

        $("#submitpost .eshb-error-message").hide();

        $(".csf-metabox .required-field").each(function () {
          let input = $(this).find("input, select");
          input.removeClass("input-error");
          let value = (input.val() || "").toString().trim(); // safe cast to string
          if (value === "") {
            e.preventDefault();
            input.addClass("input-error");
            isValid = false;
          }
        });

        if (!isValid) {
          $("#submitpost .eshb-error-message").show();
        } else {
          $("body.post-type-eshb_booking form#post").submit();
        }
      });
    },
    getCustomerDetailsFromMetabox: function (params) {
      const formElement = document.querySelector(
        "#eshb_booking_metaboxes .eshb-booking-form-customer-details"
      );
      const inputs = formElement.querySelectorAll("input, select, textarea");
      const formData = {};

      inputs.forEach((input) => {
        const name = input.name;
        const value = input.value;
        if (name) {
          formData[name] = value;
        }
      });

      return formData;
    },
    bindEventsForAccomodationMetas: function () {
      let eshbCalVars = ESHBPUBLICBOOKING.eshbCalVars();
      let startDateInput = eshbCalVars.startDateInput;
      let endDateInput = eshbCalVars.endDateInput;
      let availableDatePickerInput = eshbCalVars.availableDatePickerInput;
      let accomodationId = eshbCalVars.accomodationId;
      let form = eshbCalVars.bookingFormEl;
      let roomQuantityInput = eshbCalVars.roomQuantityInput;

      $(document).on(
        "change.ESHBPUBLICBOOKING",
        '#eshb_booking_metaboxes select[name="eshb_booking_metaboxes[booking_accomodation_id]"]',
        function () {
          accomodationId = $(this).val();

          $(
            '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_start_time]"]'
          ).val('');
          $(
            '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_end_time]"]'
          ).val('');

          ESHBPUBLICBOOKING.setBookingFormCalendar(
            startDateInput,
            endDateInput,
            availableDatePickerInput,
            roomQuantityInput,
            accomodationId,
            form
          );

        }
      );
    },
    calendarDefaultsOps: {
      //"parentEl": parentEl,
      alwaysShowCalendars: true,
      // "showDropdowns":true,
      timePicker: false,
      autoUpdateInput: false,
      autoApply: true,
      locale: {
        format: "YYYY-MM-DD",
        separator: " - ",
        applyLabel: eshb_daterangepicker_i18n.applyLabel,
        cancelLabel: eshb_daterangepicker_i18n.cancelLabel,
        holidayTooltip: eshb_daterangepicker_i18n.holidayTooltip,
        BookedTooltip: eshb_daterangepicker_i18n.BookedTooltip,
        fromLabel: eshb_daterangepicker_i18n.fromLabel,
        toLabel: eshb_daterangepicker_i18n.toLabel,
        customRangeLabel: eshb_daterangepicker_i18n.customRangeLabel,
        daysOfWeek: moment.weekdaysShort(),
        firstDay: 1,
      },
      linkedCalendars: true,
      showCustomRangeLabel: false,
      startDate: moment().startOf("day"),
      endDate: moment().startOf("hour").add(24, "hour"),
      opens: "right",
      minDate: moment().startOf("day"), // Disable previous dates
      isInvalidDate: function (date) {
        // Disable the booked dates
        if (ESHBPUBLICBOOKING.isDateBooked(date, bookedDates)) {
          return ESHBPUBLICBOOKING.isDateBooked(date, bookedDates);
        }

        // Disable the holidays dates
        if (ESHBPUBLICBOOKING.isDateholiDay(date, holiDayDates)) {
          return ESHBPUBLICBOOKING.isDateholiDay(date, holiDayDates);
        }

        // Disable the disallowed dates
        if (ESHBPUBLICBOOKING.isDisallowedDates(date, allowedDays)) {
          return ESHBPUBLICBOOKING.isDisallowedDates(date, allowedDays);
        }
      },
      isCustomDate: function (date) {
        const formatted = date.format("YYYY-MM-DD");
        if (ESHBPUBLICBOOKING.isDateBooked(date, bookedDates)) {
          return "booked-date";
        }
        if (ESHBPUBLICBOOKING.isDateholiDay(date, holiDayDates)) {
          return "holiday-date";
        }
        if (ESHBPUBLICBOOKING.isDisallowedDates(date, allowedDays)) {
          return "disallowed-date";
        }
        return false;
      },
    },
    isDatePrevious: function (dateStr) {
      // Split and parse date string safely
      const [year, month, day] = dateStr
        .split(",")
        .map((s) => parseInt(s.trim(), 10));

      // Build a date object explicitly in UTC (no local time confusion)
      const givenDate = new Date(Date.UTC(year, month - 1, day));

      // Get current date in UTC (not local time)
      const now = new Date();
      const utcToday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      // Get yesterday in UTC
      const utcYesterday = new Date(utcToday.getTime() - 86400000); // 86400000ms = 1 day

      // Compare raw timestamps to avoid string format issues
      return givenDate.getTime() > utcYesterday.getTime();
    },
    isDateBooked: function (date, bookedDates) {
      // Split and parse date string safely
      const formattedDate = moment(date).format("YYYY-MM-DD");

      return bookedDates.includes(formattedDate);
    },
    isDateCheckIn: function (date, checkedInOutDates) {
      const checkIndates = checkedInOutDates?.checked_in;
      const formattedDate = moment(date).format("YYYY-MM-DD");

      // Check if array exists and includes the formatted date
      return (
        Array.isArray(checkIndates) && checkIndates.includes(formattedDate)
      );
    },
    isDateCheckOut: function (date, checkedInOutDates) {
      const checkOutdates = checkedInOutDates?.checked_out;
      const formattedDate = moment(date).format("YYYY-MM-DD");

      // Check if array exists and includes the formatted date
      return (
        Array.isArray(checkOutdates) && checkOutdates.includes(formattedDate)
      );
    },
    isDateholiDay: function (date, holiDayDates) {
      return holiDayDates.includes(date.format("YYYY-MM-DD"));
    },
    isDisallowedDates: function (date, allowedDays) {
      var dayName = date.format("dddd").toLowerCase();
      if (!Array.isArray(allowedDays)) return true;
      return !allowedDays.includes(dayName);
    },
    getPreviousDate: function (date) {
      const original = moment(date);
      const prevDate = moment(original).subtract(1, "days"); // Safe clone
      return prevDate.format("YYYY-MM-DD");
    },
    updateEshbCalendar: function (
      startDateInput,
      endDateInput,
      availableDatePickerInput,
      roomQuantityInput,
      accomodationId,
      form,
      renderTimeSlotsList = false
    ) {
      let newStartDate = startDateInput.val();
      let newEndDate = endDateInput.val();

      if (eshb_ajax.is_admin && renderTimeSlotsList) {
        newEndDate = newStartDate;
        endDateInput.val(newEndDate);
      }

      // Ensure both dates are not empty and valid
      if (newStartDate && newEndDate) {
        // Update daterangepicker start and end date
        let startDatePicker = startDateInput.data("daterangepicker");
        let endDatePicker = endDateInput.data("daterangepicker");

        startDatePicker.setStartDate(newStartDate);
        startDatePicker.setEndDate(newEndDate);

        endDatePicker.setStartDate(newStartDate);
        endDatePicker.setEndDate(newEndDate);

        if (availableDatePickerInput.length) {
          let availableDatePicker =
            availableDatePickerInput.data("daterangepicker");
          availableDatePicker.setStartDate(newStartDate);
          availableDatePicker.setEndDate(newEndDate);
          availableDatePickerInput.trigger("click");
        }

        // update time slots by dates
        if (newStartDate == newEndDate) {
          ESHBPUBLICBOOKING.updateTimeSlotsHtml(
            accomodationId,
            newStartDate,
            newEndDate
          );
          // show available rooms count
          ESHBPUBLICBOOKING.updateAvailabilityNotice(
            form,
            startDateInput,
            endDateInput,
            roomQuantityInput,
            accomodationId
          );
        } else {
          // show available rooms count
          ESHBPUBLICBOOKING.updateAvailabilityNotice(
            form,
            startDateInput,
            endDateInput,
            roomQuantityInput,
            accomodationId
          );
        }
      }
    },
    isBookingEditMode: function () {
      const params = new URLSearchParams(window.location.search);
      const post = params.get("post");
      const action = params.get("action");

      return !!(post && action === "edit");
    },
    getnextAllowedStartDate: function (allowedDays, date) {
      var givenDate = moment(date, "YYYY-MM-DD");
      var dayOfWeek = givenDate.day();
      var targetDay = moment().day(allowedDays[0]).day();

      if (dayOfWeek !== targetDay) {
        var daysToAdd = (targetDay - dayOfWeek + 7) % 7 || 7;
        givenDate.add(daysToAdd, "days");
      }

      return givenDate.format("YYYY-MM-DD");
    },
    hasBookedDatesInRange: function (
      startDate,
      endDate,
      bookedDates,
      checkedInOutDates
    ) {
      const rangeStart = moment(startDate);
      const rangeEnd = moment(endDate);

      // Conflict 1: bookedDates within selected range (always conflict, even if it's check-in)
      const isBookedInRange = bookedDates.some((dateStr) => {
        const date = moment(dateStr, "YYYY-MM-DD");
        return date.isBetween(rangeStart, rangeEnd, "day", "[]"); // inclusive
      });

      const isEndDateInBooked = bookedDates.some((dateStr) => {
        const date = moment(dateStr, "YYYY-MM-DD");
        return date.isSame(rangeEnd, "day");
      });

      // Conflict 2: endDate in checked out dates (someone is checking out that day – can't check-in)
      const isEndInCheckedOut = checkedInOutDates?.checked_out?.includes(
        rangeEnd.format("YYYY-MM-DD")
      );

      // Conflict 3: endDate is a check-in date (acceptable — so handled specially)
      const isEndDateConflict = checkedInOutDates?.checked_in?.some(
        (dateStr) => {
          const checkinDate = moment(dateStr, "YYYY-MM-DD");
          return checkinDate.isSame(rangeEnd, "day");
        }
      );

      // Final decision logic
      let conflict = isBookedInRange;

      if (isBookedInRange && isEndDateConflict) {
        conflict = false;
      }

      if (isEndInCheckedOut && !isEndDateInBooked) {
        conflict = true;
      }

      return conflict;
    },
    getNextAvailableStartDate: function (startDate, endDate, bookedDates) {
      const rangeStart = moment(startDate, "YYYY-MM-DD");
      let rangeEnd = moment(endDate, "YYYY-MM-DD");

      if (rangeStart.isSame(rangeEnd, "day")) {
        rangeEnd.add(1, "days"); // add 1 day to rangeEnd
      }

      // Step 1: Get all booked dates within the selected range
      const bookedInRange = bookedDates
        .map((dateStr) => moment(dateStr, "YYYY-MM-DD"))
        .filter((date) => date.isBetween(rangeStart, rangeEnd, "day", "[]"));

      // Step 2: If no booked dates, return null (no need to change)
      if (bookedInRange.length === 0) return null;

      // Step 3: Find the last booked date in the range
      const lastBooked = moment.max(bookedInRange);

      // Step 4: Start checking from the day after lastBooked
      for (let i = 1; i <= 30; i++) {
        const nextDay = moment(lastBooked).add(i, "days");
        const afterNextDay = moment(lastBooked).add(i + 1, "days");

        const isNextBooked = ESHBPUBLICBOOKING.isDateBooked(
          nextDay,
          bookedDates
        );
        const isAfterNextBooked = ESHBPUBLICBOOKING.isDateBooked(
          afterNextDay,
          bookedDates
        );

        if (!isNextBooked && !isAfterNextBooked) {
          return nextDay.format("YYYY-MM-DD");
        }
      }

      // Step 5: No available 2-day slot found
      return null;
    },
    checkInDayErrors: function (
      allowedDays,
      selectedDay,
      optionsDate,
      defaultDate
    ) {
      // check seleceted day in allowedDays
      if (allowedDays != "" && !allowedDays.includes(selectedDay)) {
        $(".eshb-booking-form .date-err-msg").html(
          eshb_ajax.checkInDayErrorMsg + " " + allowedDays[0]
        );
        setTimeout(() => {
          $(".eshb-booking-form .date-err-msg").html("");
        }, 3000);

        // Update the input field manually
        return optionsDate;
      } else {
        return defaultDate;
      }
    },
    minMaxErr: function (minNights, maxNights, picker, startDateInput, endDateInput, availableDatePickerInput, roomQuantityInput, accomodationId, form) {
      let translations = eshb_ajax.translations;

      if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
        translations = eshb_ajax.admin_translations;
      }

      var diff = picker.endDate.diff(picker.startDate, "days");

      let isValid = true;
      if (!document.querySelector('.date-err-msg')) return;
      document.querySelector('.date-err-msg').innerHTML = '';
      if (minNights > 1 && diff < minNights) {
        document.querySelector('.date-err-msg').innerHTML = translations.minNightsErrorMsgAvCal + minNights;
        isValid = false;
      } else if (maxNights !== 0 && diff > maxNights) {
        isValid = false;
        document.querySelector('.date-err-msg').innerHTML = translations.maxNightsErrorMsgAvCal + maxNights;
      }
      if (isValid !== true) {
        ESHBPUBLICBOOKING.resetCalendar(minNights, picker, startDateInput, endDateInput, availableDatePickerInput, roomQuantityInput, accomodationId, form);
      }

      setTimeout(() => {

        document.querySelector('.date-err-msg').innerHTML = '';
      }, 4000);
    },
    resetCalendar: function (minNights, picker, startDateInput, endDateInput, availableDatePickerInput, roomQuantityInput, accomodationId, form) {

      let startDateBuffer = parseFloat(eshb_ajax.calendar_start_date_buffer);
      let startDate = moment().startOf("day").add(startDateBuffer, "days");
      let endDate = moment().startOf("hour").add(minNights + startDateBuffer, "days");

      let formatedStartDate = startDate.format("YYYY-MM-DD");
      let formatedEndDate = endDate.format("YYYY-MM-DD");

      picker.setStartDate(startDate);
      picker.setEndDate(endDate);

      startDateInput.val(formatedStartDate);
      endDateInput.val(formatedEndDate);

      ESHBPUBLICBOOKING.updateEshbCalendar(
        startDateInput,
        endDateInput,
        availableDatePickerInput,
        roomQuantityInput,
        accomodationId,
        form
      );
    },
    setEshbFormCalendar: function (
      startDateInput,
      endDateInput,
      availableDatePickerInput,
      roomQuantityInput,
      accomodationId,
      form,
      bookedDates = Array(),
      checkedInOutDates = Array(),
      holiDayDates = Array(),
      allowedDays = "",
      allowSingleDate = false,
      minNights = 1,
      maxNights = 365
    ) {
      let options = this.calendarDefaultsOps;
      options.startDate = $(startDateInput).val();
      options.endDate = $(endDateInput).val();


      let startDateBuffer = parseFloat(eshb_ajax.calendar_start_date_buffer);


      minNights = parseInt(minNights);
      maxNights = parseInt(maxNights);

      options.minDate = moment().startOf("day").add(startDateBuffer, "days");
      options.endDate = moment().startOf("hour").add(minNights + startDateBuffer, "days");

      if (minNights > 1 && options.startDate !== options.endDate) {
        allowSingleDate = false;
      }

      if (allowedDays != "") {
        let nextAllowedStartDate = ESHBPUBLICBOOKING.getnextAllowedStartDate(
          allowedDays,
          options.startDate
        );

        // add one day to the next allowed start date if allowed days is more than one or make same as start date if only one day is allowed

        //allowedDays is not empty
        if (allowedDays.length > 0) {
          nextAllowedEndDate = moment(nextAllowedStartDate)
            .add(1, "days")
            .format("YYYY-MM-DD");
        } else {
          nextAllowedEndDate =
            moment(nextAllowedStartDate).format("YYYY-MM-DD");
        }

        options.startDate = nextAllowedStartDate;
        options.endDate = nextAllowedEndDate;

        startDateInput.val(nextAllowedStartDate);
        endDateInput.val(nextAllowedEndDate);
      }

      if (allowSingleDate == true) {
        options.singleDatePicker = true;
        options.autoApply = true;
      }

      options.isInvalidDate = function (date) {
        // Disable the booked dates
        if (ESHBPUBLICBOOKING.isDateBooked(date, bookedDates)) {
          // Match format with bookedDates
          let yesterdayStr = date
            .clone()
            .subtract(1, "days")
            .format("YYYY-MM-DD");
          let isYesterdayBooked = bookedDates.includes(yesterdayStr);

          if (
            ESHBPUBLICBOOKING.isDateCheckIn(date, checkedInOutDates) &&
            ESHBPUBLICBOOKING.isDateCheckOut(date, checkedInOutDates)
          ) {
            //return ESHBPUBLICBOOKING.isDateBooked(date, bookedDates);
            if (isYesterdayBooked) {
              return ESHBPUBLICBOOKING.isDateBooked(date, bookedDates);
            }
          } else if (
            !ESHBPUBLICBOOKING.isDateCheckIn(date, checkedInOutDates) &&
            !ESHBPUBLICBOOKING.isDateCheckOut(date, checkedInOutDates)
          ) {
            return ESHBPUBLICBOOKING.isDateBooked(date, bookedDates);
          }
        }

        // Disable the holidays dates
        if (ESHBPUBLICBOOKING.isDateholiDay(date, holiDayDates)) {
          return ESHBPUBLICBOOKING.isDateholiDay(date, holiDayDates);
        }

        if (allowedDays != "") {
          // Disable the disallowed dates
          if (ESHBPUBLICBOOKING.isDisallowedDates(date, allowedDays)) {
            return ESHBPUBLICBOOKING.isDisallowedDates(date, allowedDays);
          }
        }
      };

      options.isCustomDate = function (date) {
        let isCheckIn = ESHBPUBLICBOOKING.isDateCheckIn(
          date,
          checkedInOutDates
        );
        let isCheckOut = ESHBPUBLICBOOKING.isDateCheckOut(
          date,
          checkedInOutDates
        );
        let isBooked = ESHBPUBLICBOOKING.isDateBooked(date, bookedDates);

        // Match format with bookedDates
        let yesterdayStr = date
          .clone()
          .subtract(1, "days")
          .format("YYYY-MM-DD");
        let isYesterdayBooked = bookedDates.includes(yesterdayStr);

        if (isCheckIn && isCheckOut && isBooked) {
          if (isYesterdayBooked) {
            return "booked-date";
          } else {
            return "checked-in-date"; // Add a class for styling
          }
        } else if (isCheckIn && isBooked) {
          return "checked-in-date";
        } else if (isCheckOut && isBooked) {
          return "booked-date";
        } else if (isCheckOut && isYesterdayBooked) {
          return "checked-out-date";
        } else if (isCheckIn && isBooked) {
          return "checked-in-date dsdd";
        } else if (isCheckOut && isYesterdayBooked) {
          return "checked-out-date";
        } else if (isBooked) {
          return "booked-date";
        }

        if (ESHBPUBLICBOOKING.isDateholiDay(date, holiDayDates)) {
          let formattedDate = date.format("YYYY, MM, DD");

          if (ESHBPUBLICBOOKING.isDatePrevious(formattedDate) === true) {
            return "holiday-date"; // Add a class for styling
          } else {
            return "previous-holiday-date";
          }
        }

        // Add a custom class
        if (ESHBPUBLICBOOKING.isDisallowedDates(date, allowedDays)) {
          if (ESHBPUBLICBOOKING.isDisallowedDates(date) === true) {
            return "disallowed-date"; // Add a class for styling
          }
        }
        return false;
      };


      // Initialize the first date range picker
      $(startDateInput).daterangepicker(options, function (start, end) {
        $(startDateInput).val(start.format("YYYY-MM-DD"));
        $(startDateInput).data("daterangepicker").setStartDate(start);
        $(endDateInput).data("daterangepicker").setEndDate(end);
      });

      // Initialize the second date range picker
      let endDatePickerOptions = { ...options };
      endDatePickerOptions.opens = "left";
      $(endDateInput).daterangepicker(
        endDatePickerOptions,
        function (start, end) {
          $(endDateInput).val(end.format("YYYY-MM-DD"));
          $(startDateInput).data("daterangepicker").setStartDate(start);
          $(startDateInput).data("daterangepicker").setEndDate(end);
        }
      );

      // Initialize the availability date range picker
      let parentEl = $(".eshb-availability-calendars");
      let optionsavailabilityCal = { ...options };

      optionsavailabilityCal.parentEl = parentEl;
      if (allowSingleDate == true) {
        optionsavailabilityCal.autoApply = true;
        optionsavailabilityCal.singleDatePicker = true;
      } else {
        optionsavailabilityCal.autoApply = false;
      }


      $(availableDatePickerInput).daterangepicker(
        optionsavailabilityCal,
        function (start, end) {
          $(startDateInput).val(start.format("YYYY-MM-DD"));
          $(endDateInput).val(end.format("YYYY-MM-DD"));
          $(availableDatePickerInput)
            .data("daterangepicker")
            .setStartDate(start);
          $(availableDatePickerInput).data("daterangepicker").setEndDate(end);

        }
      );
      availableDatePickerInput.trigger("click");

      // Event listener for the first date range picker
      $(startDateInput).on("apply.daterangepicker", function (ev, picker) {

        // validate min max nights
        ESHBPUBLICBOOKING.minMaxErr(minNights, maxNights, picker, startDateInput, endDateInput, availableDatePickerInput, roomQuantityInput, accomodationId, form);


        let startDate = picker.startDate.format("YYYY-MM-DD");
        let endDate = picker.endDate.format("YYYY-MM-DD");

        // check seleceted day in allowedDays and show errors
        selectedDay = picker.startDate.format("dddd").toLowerCase();
        startDate = ESHBPUBLICBOOKING.checkInDayErrors(
          allowedDays,
          selectedDay,
          options.startDate,
          startDate
        );

        // set closest next checkout date as start date if start date is same as end date and booked
        if (
          startDate == endDate &&
          ESHBPUBLICBOOKING.isDateBooked(startDate, bookedDates)
        ) {
          let closestNextCheckoutDate =
            ESHBPUBLICBOOKING.getNextAvailableStartDate(
              startDate,
              endDate,
              bookedDates
            );
          if (closestNextCheckoutDate) {
            startDate = closestNextCheckoutDate;
            picker.setStartDate(startDate);
          }
        }

        // set closest next checkout date as start date
        if (Array.isArray(checkedInOutDates?.checked_out)) {
          if (
            ESHBPUBLICBOOKING.hasBookedDatesInRange(
              startDate,
              endDate,
              bookedDates,
              checkedInOutDates
            )
          ) {
            let closestNextCheckoutDate =
              ESHBPUBLICBOOKING.getNextAvailableStartDate(
                startDate,
                endDate,
                bookedDates
              );
            if (closestNextCheckoutDate) {
              startDate = closestNextCheckoutDate;
              picker.setStartDate(startDate);
            }
          }
        }

        let reqquiredNights = minNights;

        if (allowSingleDate != true) {
          var start = picker.startDate;
          var end = picker.endDate;
          var diff = end.diff(start, "days"); // check the difference in days

          if (diff < minNights || diff > maxNights) {

            if (diff > maxNights) {
              reqquiredNights = maxNights;
            }

            end = start.clone().add(reqquiredNights, "days");
            picker.setEndDate(end);

            // Update the input field manually
            $(this).val(start.format("YYYY-MM-DD"));
            endDate = end.format("YYYY-MM-DD");
          }
        }

        $(startDateInput).val(startDate);
        $(endDateInput).val(endDate);

        $(availableDatePickerInput).val(startDate);
        $(availableDatePickerInput).val(endDate);

        // Update all calendar
        if (!accomodationId || accomodationId == "") return;
        ESHBPUBLICBOOKING.updateEshbCalendar(
          startDateInput,
          endDateInput,
          availableDatePickerInput,
          roomQuantityInput,
          accomodationId,
          form
        );
        ESHBPUBLICBOOKING.updatePricingTable();
      });

      // Event listener for the second date range picker
      $(endDateInput).on("apply.daterangepicker", function (ev, picker) {

        // validate min max nights
        ESHBPUBLICBOOKING.minMaxErr(minNights, maxNights, picker, startDateInput, endDateInput, availableDatePickerInput, roomQuantityInput, accomodationId, form);

        let startDate = picker.startDate.format("YYYY-MM-DD");
        let endDate = picker.endDate.format("YYYY-MM-DD");

        // check seleceted day in allowedDays and show errors
        selectedDay = picker.startDate.format("dddd").toLowerCase();
        startDate = ESHBPUBLICBOOKING.checkInDayErrors(
          allowedDays,
          selectedDay,
          options.startDate,
          startDate
        );

        // set closest next checkout date as start date if start date is same as end date and booked
        if (
          startDate == endDate &&
          ESHBPUBLICBOOKING.isDateBooked(startDate, bookedDates)
        ) {
          let closestNextCheckoutDate =
            ESHBPUBLICBOOKING.getNextAvailableStartDate(
              startDate,
              endDate,
              bookedDates
            );
          if (closestNextCheckoutDate) {
            startDate = closestNextCheckoutDate;
            picker.setStartDate(startDate);
          }
        }

        // set closest next checkout date as start date
        if (Array.isArray(checkedInOutDates?.checked_out)) {
          if (
            ESHBPUBLICBOOKING.hasBookedDatesInRange(
              startDate,
              endDate,
              bookedDates,
              checkedInOutDates
            )
          ) {
            let closestNextCheckoutDate =
              ESHBPUBLICBOOKING.getNextAvailableStartDate(
                startDate,
                endDate,
                bookedDates
              );
            if (closestNextCheckoutDate) {
              startDate = closestNextCheckoutDate;
              picker.setStartDate(startDate);
            }
          }
        }

        let reqquiredNights = minNights;

        if (allowSingleDate != true) {
          var start = picker.startDate;
          var end = picker.endDate;
          var diff = end.diff(start, "days"); // check the difference in days

          if (diff < minNights || diff > maxNights) {

            if (diff > maxNights) {

              reqquiredNights = maxNights;
            }

            end = start.clone().add(reqquiredNights, "days");
            picker.setEndDate(end);

            // Update the input field manually
            $(this).val(start.format("YYYY-MM-DD"));
            endDate = end.format("YYYY-MM-DD");
          }
        }

        $(startDateInput).val(startDate);
        $(endDateInput).val(endDate);

        $(availableDatePickerInput).val(startDate);
        $(availableDatePickerInput).val(endDate);

        // // Update first date picker
        ESHBPUBLICBOOKING.updateEshbCalendar(
          startDateInput,
          endDateInput,
          availableDatePickerInput,
          roomQuantityInput,
          accomodationId,
          form
        );
        //ESHBPUBLICBOOKING.updatePricingTable();
      });

      // Event listener for the first date range picker
      $(availableDatePickerInput).on(
        "apply.daterangepicker",
        function (ev, picker) {
          if (startDateInput.length) {
            let startDate = picker.startDate.format("YYYY-MM-DD");
            let endDate = picker.endDate.format("YYYY-MM-DD");

            let minMaxValid = true;
            var diff = picker.endDate.diff(picker.startDate, "days");

            document.querySelector('.eshb-availability-calendars-err').innerHTML = '';
            if (minNights > 1 && diff < minNights) {
              minMaxValid = false;
              document.querySelector('.eshb-availability-calendars-err').innerHTML = eshb_ajax.translations.minNightsErrorMsgAvCal + minNights;

            } else if (maxNights !== 0 && diff > maxNights) {
              minMaxValid = false;
              document.querySelector('.eshb-availability-calendars-err').innerHTML = eshb_ajax.translations.maxNightsErrorMsgAvCal + maxNights;
            }
            if (minMaxValid != true) {
              ESHBPUBLICBOOKING.resetCalendar(minNights, picker, startDateInput, endDateInput, availableDatePickerInput, roomQuantityInput, accomodationId, form);
              return setTimeout(() => {
                document.querySelector('.eshb-availability-calendars-err').innerHTML = '';
              }, 4000);
            }


            // check seleceted day in allowedDays and show errors
            selectedDay = picker.startDate.format("dddd").toLowerCase();
            startDate = ESHBPUBLICBOOKING.checkInDayErrors(
              allowedDays,
              selectedDay,
              options.startDate,
              startDate
            );

            // set closest next checkout date as start date if start date is same as end date and booked
            if (
              startDate == endDate &&
              ESHBPUBLICBOOKING.isDateBooked(startDate, bookedDates)
            ) {
              let closestNextCheckoutDate =
                ESHBPUBLICBOOKING.getNextAvailableStartDate(
                  startDate,
                  endDate,
                  bookedDates
                );
              if (closestNextCheckoutDate) {
                startDate = closestNextCheckoutDate;
                picker.setStartDate(startDate);
              }
            }

            // set closest next checkout date as start date if start date is same as end date and booked
            if (Array.isArray(checkedInOutDates?.checked_out)) {
              if (
                ESHBPUBLICBOOKING.hasBookedDatesInRange(
                  startDate,
                  endDate,
                  bookedDates,
                  checkedInOutDates
                )
              ) {
                let closestNextCheckoutDate =
                  ESHBPUBLICBOOKING.getNextAvailableStartDate(
                    startDate,
                    endDate,
                    bookedDates
                  );
                if (closestNextCheckoutDate) {
                  startDate = closestNextCheckoutDate;
                  picker.setStartDate(startDate);
                }
              }
            }

            let reqquiredNights = minNights;

            if (allowSingleDate != true) {
              var start = picker.startDate;
              var end = picker.endDate;
              var diff = end.diff(start, "days"); // check the difference in days

              if (diff < minNights || diff > maxNights) {
                if (diff > maxNights) {
                  reqquiredNights = maxNights;
                }
                end = start.clone().add(reqquiredNights, "days");
                picker.setEndDate(end);

                // Update the input field manually
                $(this).val(start.format("YYYY-MM-DD"));
                endDate = end.format("YYYY-MM-DD");
              }
            }

            $(startDateInput).val(startDate);
            $(endDateInput).val(endDate);
            $(availableDatePickerInput).val(startDate);

            $(endDateInput).attr("value", startDate);
            $(endDateInput).attr("value", endDate);

            ESHBPUBLICBOOKING.updateEshbCalendar(
              startDateInput,
              endDateInput,
              availableDatePickerInput,
              roomQuantityInput,
              accomodationId,
              form
            );

            const element = document.getElementById("eshb-aside");
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
        }
      );

      $(availableDatePickerInput).on('cancel.daterangepicker', function (ev, picker) {

        let startDateBuffer = parseFloat(eshb_ajax.calendar_start_date_buffer);
        let startDate = moment().startOf("day").add(startDateBuffer, "days");
        let endDate = moment().startOf("hour").add(minNights + startDateBuffer, "days");

        let formatedStartDate = startDate.format("YYYY-MM-DD");
        let formatedEndDate = endDate.format("YYYY-MM-DD");

        picker.setStartDate(startDate);
        picker.setEndDate(endDate);

        startDateInput.val(formatedStartDate);
        endDateInput.val(formatedEndDate);

        ESHBPUBLICBOOKING.updateEshbCalendar(
          startDateInput,
          endDateInput,
          availableDatePickerInput,
          roomQuantityInput,
          accomodationId,
          form
        );
      });
    },
    setBookingFormCalendar: function (
      startDateInput,
      endDateInput,
      availableDatePickerInput,
      roomQuantityInput,
      accomodationId,
      form
    ) {
      if (!accomodationId) return;

      $.post(
        eshb_ajax.ajaxurl,
        {
          action: "eshb_get_disabled_dates_by_accomodation_id",
          accomodation_id: accomodationId,
          nonce: eshb_ajax.nonce,
        },
        function (response) {
          if (response.success) {
            checkedInOutDates = response.data.checked_in_out_dates;
            bookedDates = response.data.booked_dates;
            holiDayDates = response.data.holiday_dates;
            allowSingleDate = response.data.single_day;
            hourlyBooking = response.data.hourly_booking;
            minNights = response.data.min_nights;
            maxNights = response.data.max_nights;
            allowedDays = response.data.allowed_check_in_day;
            allowedDaysArray = [];
            availableTimeSlots = response.data.available_slots;

            let isRenderTimeSlots = false;

            if (hourlyBooking) {
              form.addClass("has-hourly-booking");
              form.find(".time-slots-metabox").css("display", "flex");
              form.find(".time-picker-metabox").removeClass("hidden-metabox");
              if (
                typeof eshb_ajax.is_admin !== "undefined" &&
                eshb_ajax.is_admin
              ) {
                isRenderTimeSlots = true;
              } else if (availableTimeSlots) {
                isRenderTimeSlots = true;
              }
            } else {
              form.find(".time-slots-metabox").css("display", "none");
              form.find(".time-picker-metabox").addClass("hidden-metabox");
            }

            if (allowedDays != "all") {
              allowedDaysArray.push(allowedDays); // Push single day into array
            }

            if (bookedDates.length > 0) {
              bookedDates = bookedDates.map((dateStr) => {
                const [year, month, day] = dateStr
                  .split(",")
                  .map((part) => part.trim().padStart(2, "0"));
                return `${year}-${month}-${day}`;
              });
            }


            ESHBPUBLICBOOKING.setEshbFormCalendar(
              startDateInput,
              endDateInput,
              availableDatePickerInput,
              roomQuantityInput,
              accomodationId,
              form,
              bookedDates,
              checkedInOutDates,
              holiDayDates,
              allowedDaysArray,
              allowSingleDate,
              minNights,
              maxNights
            );
            $(".holiday-date").attr("title", "Holiday");
            ESHBPUBLICBOOKING.updateEshbCalendar(
              startDateInput,
              endDateInput,
              availableDatePickerInput,
              roomQuantityInput,
              accomodationId,
              form,
              isRenderTimeSlots
            );
          }
        }
      );

      $(".booking-date-picker").on(
        "apply.daterangepicker",
        function (ev, picker) {
          let startDate = picker.startDate.format("YYYY-MM-DD");
          let endDate = picker.endDate.format("YYYY-MM-DD");

          $(this).parent().find('input[name="start_date"]').val(startDate);
          $(this).parent().find('input[name="end_date"]').val(endDate);

          let url = new URL(window.location.href);

          // Modify the 'param' value
          url.searchParams.set("start_date", startDate);
          url.searchParams.set("end_date", endDate);

          // Update the URL without reloading the page
          window.history.pushState({}, "", url);
        }
      );
    },
    selectTimeSlot: function () {
      $(this).parent().parent().find(".eshb-time-slot").removeClass("selected");
      $(this).parent().addClass("selected");
      $(this).find('input[name="time-slot"]').prop("checked", true);

      let selecetedStartTime = $(this)
        .parent()
        .find('input[name="start_time"]')
        .val();
      let selecetedEndTime = $(this)
        .parent()
        .find('input[name="end_time"]')
        .val();

      // update actual time fields metabox input for admin booking
      if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
        setTimeout(() => {
          $(
            '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_start_time]"]'
          ).val(selecetedStartTime);
          $(
            '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_end_time]"]'
          ).val(selecetedEndTime);
        }, 1000);
      }

      ESHBPUBLICBOOKING.updatePricingTable();
    },
    updateTimeSlotsHtml: function (accomodationId, startDate, endDate) {
      let bookingStartTime = $(
        '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_start_time]"]'
      ).val();
      let bookingEndTime = $(
        '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_end_time]"]'
      ).val();

      let excludes = [];
      if (
        ESHBPUBLICBOOKING.isBookingEditMode() &&
        bookingStartTime !== "" &&
        bookingEndTime !== ""
      ) {
        excludes = [bookingStartTime, bookingEndTime];
      }

      $.post(
        eshb_ajax.ajaxurl,
        {
          action: "get_time_slots_data",
          accomodationId,
          startDate,
          endDate,
          excludes,
          nonce: eshb_ajax.nonce,
        },
        function (response) {
          if (!response.success || !response.data) return;
          const availableTimeSlots =
            response?.data?.available_times?.available_slots || [];

          ESHBPUBLICBOOKING.renderTimeSlotsList(availableTimeSlots);


          let selecetedStartTime = $(
            '.eshb-time-slot.selected input[name="start_time"]'
          ).val();
          let selecetedEndTime = $(
            '.eshb-time-slot.selected input[name="end_time"]'
          ).val();

          // update actual time fields metabox input for admin booking
          if (
            (bookingStartTime === "" || bookingEndTime == "") &&
            typeof eshb_ajax.is_admin !== "undefined" &&
            eshb_ajax.is_admin
          ) {
            setTimeout(() => {


              $(
                '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_start_time]"]'
              ).val(selecetedStartTime);
              $(
                '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_end_time]"]'
              ).val(selecetedEndTime);
            }, 1000);
          }
          ESHBPUBLICBOOKING.updatePricingTable();
        }
      );
    },
    triggerTimePicker: function (el) {
      if (!el) return;

      if (el instanceof jQuery) {
        el = el.get(0);
      }
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        // Firefox fallback
        el.focus();
      }
    },
    convertTo12HourFormat: function (time) {
      // time = "13:00"
      let [hour, minute] = time.split(":").map(Number);

      let ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;

      // leading zero add
      let formattedHour = hour.toString().padStart(2, "0");
      return `${formattedHour}:${minute
        .toString()
        .padStart(2, "0")} ${ampm.toLowerCase()}`;
    },
    validateTimePicker: function () {
      let inputEl = $(this);

      if (inputEl instanceof jQuery) {
        inputEl = inputEl.get(0);
      }

      const value = inputEl.value;
      if (!value) return true;

      const min = inputEl.getAttribute("min");
      const max = inputEl.getAttribute("max");

      const startTime = document.querySelector(
        '.eshb-time-slot.selected input[name="start_time"]'
      ).value;
      const endTime = document.querySelector(
        '.eshb-time-slot.selected input[name="end_time"]'
      ).value;

      let errMsg = "";

      // helper function → "HH:MM"
      const toMinutes = (t) => {
        if (!t) return null;
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const valMin = toMinutes(min);
      const valMax = toMinutes(max);
      let valNow = toMinutes(value);

      let isValid = true;
      if (valMin !== null && valNow < valMin) isValid = false;
      if (valMax !== null && valNow > valMax) isValid = false;
      if (startTime == endTime) isValid = false;

      // invalid
      if (!isValid) {
        inputEl.classList.add("time-invalid");

        let translations = eshb_ajax.translations;
        if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
          translations = eshb_ajax.admin_translations;
        }

        if (valNow > valMax) {
          errMsg =
            translations.maximumTimeSlot +
            " " +
            ESHBPUBLICBOOKING.convertTo12HourFormat(max);
          valNow = max;
        } else if (valNow < valMin) {
          errMsg =
            translations.minimumTimeSlot +
            " " +
            ESHBPUBLICBOOKING.convertTo12HourFormat(min);
          valNow = min;
        } else if (startTime == endTime) {
          valNow = ESHBPUBLICBOOKING.addHours(endTime, +1, true);
          errMsg =
            translations.minimumTimeSlot +
            " " +
            ESHBPUBLICBOOKING.convertTo12HourFormat(valNow);
        }
        inputEl.value = valNow;
        document.querySelector(".time-err-msg").innerHTML = errMsg;
        setTimeout(() => {
          document.querySelector(".time-err-msg").innerHTML = "";
        }, 4000);
      } else {
        inputEl.classList.remove("time-invalid");

        // update actual time fields metabox input for admin booking
        if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
          setTimeout(() => {
            $(
              '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_start_time]"]'
            ).val(startTime);
            $(
              '#eshb_booking_metaboxes input[name="eshb_booking_metaboxes[booking_end_time]"]'
            ).val(endTime);
          }, 1000);
        }
      }

      return isValid;
    },
    addHours: function (time, hoursToAdd, plus = true) {
      let [hours, minutes] = time.split(":").map(Number);
      let date = new Date();
      date.setHours(hours);
      date.setMinutes(minutes);

      // add hour
      date.setHours(date.getHours() + (plus ? hoursToAdd : -hoursToAdd));

      // return with 24 format
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    },
    renderTimeSlotsList: function (
      availableTimeSlots = []
    ) {
      let timeSlotElWrapper = $(".time-slots-wrapper");
      let timeSlotEl = $(timeSlotElWrapper).find(".time-slots");
      let timeSlotsErrContainer = $('.time-slots-wrapper .empty-slot-msg');
      let timeSlotHtml = "";

      if (availableTimeSlots != "") {
        timeSlotsErrContainer.css('display', 'none');
        timeSlotElWrapper.addClass("has-time-slots");

        let slotIndex = 0;
        availableTimeSlots.map((timeSlot) => {
          slotIndex++;

          max_start = ESHBPUBLICBOOKING.addHours(timeSlot[1], 1, false);
          min_end = ESHBPUBLICBOOKING.addHours(timeSlot[0], 1);

          timeSlotHtml += `<div class="eshb-form-groups eshb-time-slot ${slotIndex == 1 ? "selected" : ""
            }">
                                <input type="radio" name="time-slot" ${slotIndex == 1 ? "checked" : ""
            } class="time-slot">
                                <div class="eshb-styled-checkbox"></div>
                                <div class="eshb-times">
                                    <div class="eshb-time-wrapper">
                                        <input type="time" id="booking-time-picker_start_time" class="booking-time-picker form-control" name="start_time" value="${timeSlot[0]
            }" min="${timeSlot[0]
            }" max="${max_start}" step="1800"> 
                                    </div>
                                    -
                                    <div class="eshb-time-wrapper">
                                        <input type="time" id="booking-time-picker_end_time" class="booking-time-picker form-control" name="end_time" value="${timeSlot[1]
            }" min="${min_end}" max="${timeSlot[1]
            }" step="1800">
                                    </div>
                                </div>
                            </div>`;
        });
        timeSlotEl.html(timeSlotHtml);
      } else {
        timeSlotElWrapper.removeClass("has-time-slots");
        timeSlotsErrContainer.css('display', 'inline-block');
        timeSlotEl.html('');
      }
    },
    eshbNumberIncreament: function (element, maxCount = "", err = "") {
      let $input = $(element).parent().find("input");
      let count = parseInt($input.val()) + 1;

      if (maxCount && maxCount != "") {
        count = count > maxCount ? maxCount : count;
      }

      $input.val(count);
      $input.change();
    },
    eshbSearchQtyNumberIncreament: function (e) {
      let $this = $(this);
      let $input = $this.parent().find("input");
      let maxCount = parseInt($input.attr("max"));
      let currentVal = parseInt($input.val());
      let nextVal = currentVal + 1;

      var errContainer = $this.closest("form").find(".err-msg");
      var errMsg = "Maximum Capacity is";

      if (
        typeof eshb_ajax !== "undefined" &&
        eshb_ajax.translations &&
        eshb_ajax.translations.maximumCapacity
      ) {
        errMsg = eshb_ajax.translations.maximumCapacity;
      }

      if (maxCount && nextVal > maxCount) {
        errContainer
          .html(errMsg + " " + maxCount)
          .css("display", "inline-block");
        setTimeout(() => {
          errContainer.html("").css("display", "none");
        }, 2000);
        return; // Do not increment
      }

      ESHBPUBLICBOOKING.eshbNumberIncreament($this, maxCount);
    },
    eshbSearchQtyNumberDecreamentFrontEnd: function (e) {
      const element = e.target;
      const input = $(element).parent().find("input");
      ESHBPUBLICBOOKING.eshbSearchQtyNumberDecreament(element, input);
    },
    eshbSearchQtyNumberDecreament: function (element, input) {
      var count = parseInt(input.val()) - 1;
      var name = input.attr("name");
      var min = 0;
      var errContainer = $(element).closest("form").parent().find(".err-msg");
      var errMsg = "Minimum Capacity is";

      if (
        typeof eshb_ajax !== "undefined" &&
        eshb_ajax.translations &&
        eshb_ajax.translations.minimumCapacity
      ) {
        errMsg = eshb_ajax.translations.minimumCapacity;
      }

      // Default Minimums
      if (name == "adult_quantity" || name == "room_quantity") {
        min = 1;
      }

      // Use search capacities from localized script if available
      if (typeof eshb_ajax !== "undefined" && eshb_ajax.search_capacities) {
        if (
          name == "adult_quantity" &&
          eshb_ajax.search_capacities.min_adult_quantity !== undefined
        ) {
          min = parseInt(eshb_ajax.search_capacities.min_adult_quantity);
        } else if (
          name == "children_quantity" &&
          eshb_ajax.search_capacities.min_children_quantity !== undefined
        ) {
          min = parseInt(eshb_ajax.search_capacities.min_children_quantity);
        }
      }

      if (count < min) {
        count = min;
        errContainer.html(errMsg + " " + min).css("display", "inline-block");
        setTimeout(() => {
          errContainer.html("").css("display", "none");
        }, 2000);
      }

      input.val(count);
      input.change();
      return false;
    },
    updateAvailabilityNotice: function (
      form,
      startDateInput,
      endDateInput,
      roomQuantityInput,
      accomodationId
    ) {
      let resultEl = $(form).find(
        ".room-capacity-status .room-capacity-number"
      );

      let query = window.location.search;
      let startDate = startDateInput.val();
      let endDate = endDateInput.val();

      let startTime = $(
        '.eshb-booking-form .eshb-time-slot.selected input[name="start_time"]'
      ).val();
      let endTime = $(
        '.eshb-booking-form .eshb-time-slot.selected input[name="end_time"]'
      ).val();

      resultEl.empty();

      $.post(
        eshb_ajax.ajaxurl,
        {
          action: "eshb_get_available_rooms_counts_data",
          accomodationId,
          startDate,
          endDate,
          startTime,
          endTime,
          nonce: eshb_ajax.nonce,
        },
        function (response) {
          if (!response.success || !response.data) return;

          let available = parseInt(response.data.available) || 0;
          let current = 0;
          let result = available > 0 ? available : 0;

          if (
            available > 0 &&
            eshb_ajax.is_admin &&
            query.includes("action=edit")
          ) {
            current = parseInt(roomQuantityInput.val()) || 0;
            result = available;
            available = available + current;
          }

          roomQuantityInput.attr({
            current: current,
            max: available,
          });

          resultEl.text(result);

          if (available > 0) {
            if (current < 1) {
              roomQuantityInput.val(1);
            }
            ESHBPUBLICBOOKING.updatePricingTable();
          }
        }
      );
    },
    fetchAccomodationMeta: function (accomodationId, startDate, endDate) {
      return new Promise((resolve, reject) => {
        $.post(eshb_ajax.ajaxurl, {
          action: "eshb_get_accomodation_meta",
          accomodationId: accomodationId,
          startDate: startDate,
          endDate: endDate,
          nonce: eshb_ajax.nonce,
        })
          .done(function (response) {
            if (response.success && response.data) {
              resolve(response.data);
            } else {
              resolve({});
            }
          })
          .fail(function () {
            reject("AJAX failed");
          });
      });
    },
    eshbBookingQtyNumberIncreamentFrontEnd: async function (e) {
      const element = e.target;
      const input = $(element).prev("input");
      ESHBPUBLICBOOKING.eshbBookingQtyNumberIncreament(element, input);
    },
    eshbBookingQtyNumberIncreamentAdmin: async function (e) {
      const element = e.target;
      const input = $(element);
      ESHBPUBLICBOOKING.eshbBookingQtyNumberIncreament(element, input);
    },
    eshbBookingQtyNumberIncreament: async function (e, input) {
      const eshbCalVars = ESHBPUBLICBOOKING.eshbCalVars();
      let form = eshbCalVars.bookingFormEl;
      //let input = $(e.target).prev('input');
      let type = input.attr("name");
      //let $this = $(e.target);
      let $this = $(e);
      let accomodationId = eshbCalVars.accomodationId;
      let maxCount = 0;
      let rooms = 1;
      let startDate = eshbCalVars.startDateInput.val();
      let endDate = eshbCalVars.endDateInput.val();
      let errContainer = $this.parent().parent().find(".err-msg");
      let adultQuantity = 1;
      let childrenQuantity = 0;
      let totaGuests = 0;
      let extraBedQuantity = 0;

      // Utility function to get field value based on multiple possible names
      function getFieldVal(names, fallback = 0) {
        for (const name of names) {
          const $field = $(form).find(`input[name="${name}"]`);
          if ($field.length) {
            const val = parseInt($field.val());
            return isNaN(val) ? fallback : val;
          }
        }
        return fallback;
      }

      // Get quantities based on input names
      rooms = getFieldVal(
        ["room_quantity", "eshb_booking_metaboxes[room_quantity]"],
        1
      );
      extraBedQuantity = getFieldVal(
        ["extra_bed_quantity", "eshb_booking_metaboxes[extra_bed_quantity]"],
        0
      );

      if (
        ["adult_quantity", "children_quantity", "service-quantity"].includes(
          type
        )
      ) {
        adultQuantity = getFieldVal(["adult_quantity"], 1);
        childrenQuantity = getFieldVal(["children_quantity"], 0);
      } else if (
        [
          "eshb_booking_metaboxes[adult_quantity]",
          "eshb_booking_metaboxes[children_quantity]",
          "eshb_booking_metaboxes[service_quantity]",
        ].includes(type)
      ) {
        adultQuantity = getFieldVal(
          ["eshb_booking_metaboxes[adult_quantity]"],
          1
        );
        childrenQuantity = getFieldVal(
          ["eshb_booking_metaboxes[children_quantity]"],
          0
        );
      }

      totaGuests = adultQuantity + childrenQuantity;

      if (accomodationId != null && accomodationId != "") {
        let currentAccomodationMeta = eshb_ajax.currentAccomodationMeta;
        let translations = eshb_ajax.translations;

        if (currentAccomodationMeta == '' || (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin)) {
          let data = await ESHBPUBLICBOOKING.fetchAccomodationMeta(
            accomodationId,
            startDate,
            endDate
          );
          currentAccomodationMeta = data.currentAccomodationMeta;
          translations = data.translations;

          eshb_ajax.currentAccomodationMeta = currentAccomodationMeta;
          eshb_ajax.requiredMinNights = data.requiredMinNights;
          eshb_ajax.requiredMaxNights = data.requiredMaxNights;
        }

        // get current accomodation meta
        let adultCapacity = parseInt(currentAccomodationMeta.adult_capacity);
        let childrenCapacity = parseInt(
          currentAccomodationMeta.children_capacity
        );
        let totalCapacity = parseInt(currentAccomodationMeta.total_capacity);



        let extraBedCapacity = parseInt(
          currentAccomodationMeta.total_extra_beds
        );
        //let roomCapacity = parseInt(currentAccomodationMeta.available_rooms);
        let roomCapacity = parseInt(input.attr("max"));

        let minCount = 0;
        let inputVal = parseInt(input.val());

        if (!eshb_ajax.is_admin) {
          inputVal = parseInt(inputVal) + 1;
        }

        let errMsg = translations.maximumCapacity;

        rooms = parseInt(rooms);

        if (
          ["adult_quantity", "eshb_booking_metaboxes[adult_quantity]"].includes(
            type
          )
        ) {
          if (adultCapacity && adultCapacity != "") {
            maxCount = adultCapacity * rooms;
            errMsg = translations.maximumCapacity;
          } else {
            if (
              childrenCapacity &&
              childrenCapacity != "" &&
              totalCapacity != ""
            ) {
              maxCount = totalCapacity - childrenCapacity;
              maxCount = maxCount * rooms;
              errMsg = translations.maximumCapacity;
            } else if (totalCapacity != "") {
              maxCount = totalCapacity - childrenQuantity;
              maxCount = maxCount * rooms;
              errMsg = translations.maximumCapacity;
            }
            if (childrenQuantity < 1) {
              errMsg = translations.maximumAdultAndChildrenCapacity;
            }
          }
        } else if (
          [
            "children_quantity",
            "eshb_booking_metaboxes[children_quantity]",
          ].includes(type)
        ) {
          if (childrenCapacity && childrenCapacity != "") {
            maxCount = childrenCapacity * rooms;
            errMsg = translations.maximumCapacity;
          } else {
            if (adultCapacity && adultCapacity != "" && totalCapacity != "") {
              maxCount = totalCapacity - adultCapacity;
              maxCount = maxCount * rooms;
              errMsg = translations.maximumCapacity;
            } else if (totalCapacity != "") {
              maxCount = totalCapacity - adultQuantity;
              maxCount = maxCount * rooms;
              errMsg = translations.maximumCapacity;
            }
            if (adultQuantity < 1) {
              errMsg = translations.maximumAdultAndChildrenCapacity;
            }
          }
        } else if (
          [
            "extra_bed_quantity",
            "eshb_booking_metaboxes[extra_bed_quantity]",
          ].includes(type)
        ) {
          if (extraBedCapacity && extraBedCapacity != "") {
            maxCount = extraBedCapacity;
          }
        } else if (
          ["room_quantity", "eshb_booking_metaboxes[room_quantity]"].includes(
            type
          )
        ) {
          if (roomCapacity && roomCapacity != "") {
            maxCount = roomCapacity;
            errMsg = translations.availableRoom;
          }
        } else if (
          [
            "service-quantity",
            "eshb_booking_metaboxes[service_quantity]",
          ].includes(type)
        ) {
          let chargeType = $(input).attr("charge_type");

          if (chargeType == "room") {
            maxCount = rooms;
            //errMsg = translations.availableRoom;
          } else {
            maxCount = adultQuantity + childrenQuantity;
            //errMsg = translations.maximumCapacity;
          }
        }

        if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
          minCount = $(input).attr("value");
          if (inputVal > maxCount && maxCount <= minCount) {
            maxCount = minCount;
          }
        }

        if (inputVal > maxCount) {
          errContainer.html(errMsg + " " + maxCount);
          $(input).val(maxCount);
          setTimeout(() => {
            errContainer.html("");
          }, 2000);
        } else {
          if (!eshb_ajax.is_admin) {
            ESHBPUBLICBOOKING.eshbNumberIncreament($this, maxCount);
          }
        }
      }
    },
    eshbBookingQtyNumberDecreamentFrontEnd: async function (e) {
      const element = e.target;
      const input = $(element).parent().find("input");
      ESHBPUBLICBOOKING.eshbBookingQtyNumberDecreament(element, input);
    },
    eshbBookingQtyNumberDecreamentAdmin: async function (e) {
      const element = e.target;
      const input = $(element).parent().find("input");
      ESHBPUBLICBOOKING.eshbBookingQtyNumberDecreament(element, input);
    },
    eshbBookingQtyNumberDecreament: async function (e, input) {
      const eshbCalVars = ESHBPUBLICBOOKING.eshbCalVars();
      let form = eshbCalVars.bookingFormEl;
      let type = input.attr("name");
      let $this = $(e);
      let accomodationId = eshbCalVars.accomodationId;
      let minCount = 0;
      let startDate = eshbCalVars.startDateInput.val();
      let endDate = eshbCalVars.endDateInput.val();
      let errContainer = $this.parent().parent().find(".err-msg");

      // Default Minimums
      if (
        ["adult_quantity", "room_quantity"].includes(type) ||
        [
          "eshb_booking_metaboxes[adult_quantity]",
          "eshb_booking_metaboxes[room_quantity]",
        ].includes(type)
      ) {
        minCount = 1;
      }

      if (accomodationId != null && accomodationId != "") {
        let currentAccomodationMeta = eshb_ajax.currentAccomodationMeta;
        let translations = eshb_ajax.translations;

        if (
          currentAccomodationMeta == "" ||
          (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin)
        ) {
          let data = await ESHBPUBLICBOOKING.fetchAccomodationMeta(
            accomodationId,
            startDate,
            endDate
          );
          currentAccomodationMeta = data.currentAccomodationMeta;
          translations = data.translations;

          eshb_ajax.currentAccomodationMeta = currentAccomodationMeta;
        }

        // Min Capacities from Meta
        if (
          currentAccomodationMeta &&
          currentAccomodationMeta.min_capacities &&
          currentAccomodationMeta.min_capacities.length > 0
        ) {
          let minData = currentAccomodationMeta.min_capacities[0];
          let minDataSettings = {};
          if (typeof eshb_ajax.booking_capacities !== "undefined" && eshb_ajax.booking_capacities) {
            minDataSettings = eshb_ajax.booking_capacities;
          }
          if (
            ["adult_quantity", "eshb_booking_metaboxes[adult_quantity]"].includes(
              type
            )
          ) {
            if (
              minData.min_adult_capacity &&
              minData.min_adult_capacity != ""
            ) {
              minCount = parseInt(minData.min_adult_capacity) || minCount;
            }

            if (minDataSettings.min_adult_quantity && minDataSettings.min_adult_quantity != "") {
              minCount = parseInt(minDataSettings.min_adult_quantity) || minCount;
            }
          }
          if (
            [
              "children_quantity",
              "eshb_booking_metaboxes[children_quantity]",
            ].includes(type)
          ) {
            if (
              minData.min_children_capacity &&
              minData.min_children_capacity != ""
            ) {
              minCount = parseInt(minData.min_children_capacity) || minCount;
            }

            if (minDataSettings.min_children_quantity && minDataSettings.min_children_quantity != "") {
              minCount = parseInt(minDataSettings.min_children_quantity) || minCount;
            }
          }
        }

        let inputVal = parseInt(input.val());
        let newVal = inputVal - 1;
        let errMsg = translations.minimumCapacity || "Minimum Capacity is";

        let minAttr = parseInt(input.attr("min"));
        if (!isNaN(minAttr) && minAttr > minCount) {
          minCount = minAttr;
        }

        if (newVal < minCount) {
          errContainer.html(errMsg + " " + minCount);
          input.val(minCount);
          setTimeout(() => {
            errContainer.html("");
          }, 2000);
        } else {
          input.val(newVal);
          input.change();
        }
      } else {
        let inputVal = parseInt(input.val());
        let newVal = inputVal - 1;
        if (newVal < minCount) newVal = minCount;
        input.val(newVal);
        input.change();
      }
    },
    hideServiceQtyDropdown: function (event) {
      let serviceQtyDropdown = $(".service-quantity-selector"); // Replace .target-element with your element's class or ID
      // Check if the click was outside the target element
      if (
        !serviceQtyDropdown.is(event.target) &&
        serviceQtyDropdown.has(event.target).length === 0
      ) {
        if (serviceQtyDropdown.hasClass("show-dropdown")) {
          // Remove the class
          serviceQtyDropdown.removeClass("show-dropdown"); // Replace 'your-class' with the class you want to remove
        }
      }
    },
    showServiceQtyDropdown: function (e, element) {
      $(".service-quantity-selector").removeClass("show-dropdown");
      $(e.currentTarget).addClass("show-dropdown");
    },
    getExtraServices: function (selectedServices = []) {
      let serviceID, quantity, title, chargeType;

      if (typeof eshb_ajax.is_admin !== "undefined" && eshb_ajax.is_admin) {
        $(
          ".booking-requirement-extra-services-fields .csf-cloneable-item"
        ).each(function () {
          serviceID = $(this).find("select option:selected").val();
          quantity = $(this)
            .find(".booking-requirement-extra-services-qty input")
            .val(); // Default quantity
          quantity = parseInt(quantity);
          title = $(this).find("select option:selected").text();
          chargeType = "";
          // Add the service ID and quantity to the selectedServices array
          if (quantity > 0) {
            selectedServices.push({
              id: serviceID,
              quantity: quantity,
              title: title,
              chargeType: chargeType,
            });
          }
        });
      } else {
        $('.eshb-booking-form input[name="extra_services[]"]:checked').each(
          function () {
            serviceID = $(this).attr("service_id");
            quantity = 1; // Default quantity
            title = $(this).attr("title");
            chargeType = $(this).attr("charge_type");

            // Check if there's a quantity selector associated with the service
            if (
              $(this)
                .parent()
                .parent()
                .find('.price-quantity input[name="service-quantity"]').length
            ) {
              quantity = $(this)
                .parent()
                .parent()
                .find('.price-quantity input[name="service-quantity"]')
                .val();
              quantity = parseInt(quantity);
            }
            // Add the service ID and quantity to the selectedServices array
            if (quantity > 0) {
              selectedServices.push({
                id: serviceID,
                quantity: quantity,
                title: title,
                chargeType: chargeType,
              });
            }
          }
        );
      }

      return selectedServices;
    },
    updatePricingTable: function () {
      const eshbCalVars = ESHBPUBLICBOOKING.eshbCalVars();

      let $form = eshbCalVars.bookingFormEl;

      if ($form.length === 0) return;

      let accomodationId = eshbCalVars.accomodationId;

      let roomQuantity = 1;
      let adultQuantity = 1;
      let childrenQuantity = 0;
      let extraBedQuantity = 0;
      let startDate = eshbCalVars.startDateInput.val();
      let endDate = eshbCalVars.endDateInput.val();

      let startTime = eshbCalVars.startTimeInput.val() ?? '';
      let endTime = eshbCalVars.endTimeInput.val() ?? '';

      roomQuantity = eshbCalVars.roomQuantityInput.val();
      adultQuantity = eshbCalVars.adultQuantityInput.val();
      childrenQuantity = eshbCalVars.childrenQuantityInput.val();
      extraBedQuantity = eshbCalVars.extraBedQuantityInput.val();

      let selectedServices = ESHBPUBLICBOOKING.getExtraServices(); // send only IDs

      $form
        .find(".cost-calculator-wrapper .pricing-values")
        .css("display", "none");
      // const start = performance.now();
      // $.post(
      //   eshb_ajax.ajaxurl,
      //   {
      //     action: "eshb_get_booking_prices",
      //     selectedServices: JSON.stringify(selectedServices),
      //     roomQuantity,
      //     adultQuantity,
      //     childrenQuantity,
      //     extraBedQuantity,
      //     accomodationId,
      //     startDate,
      //     endDate,
      //     startTime,
      //     endTime,
      //     nonce: eshb_ajax.nonce,
      //   },
      //   function (response) {
      //      const end = performance.now();
      //     console.log(`Response time: ${end - start} ms`);
      //     if (response.success) {
      //       let prices = response.data;
      //       let regularSubtotalPrice = parseFloat(prices.regularSubtotalPrice);
      //       let subtotalPrice = parseFloat(prices.subtotalPrice);
      //       let totalPrice = parseFloat(prices.totalPrice);
      //       let regularTotalPrice = parseFloat(prices.regularTotalPrice);
      //       let extraServicesPrice = parseFloat(prices.extraServicesPrice);
      //       let extraBedPrice = parseFloat(prices.extraBedPrice);
      //       let basePrice = parseFloat(prices.basePrice);
      //       let currencySymbol = prices.currencySymbol;
      //       let currencyPosition = prices.currencyPosition;

      //       // show discounted pricing
      //       if (
      //         totalPrice < regularTotalPrice &&
      //         totalPrice != regularTotalPrice
      //       ) {
      //         $form
      //           .find(".cost-calculator-wrapper")
      //           .addClass("has-discounted-price");
      //       } else {
      //         $form
      //           .find(".cost-calculator-wrapper")
      //           .removeClass("has-discounted-price");

      //       }

      //       // Conditional DOM updates
      //       let updateIfChanged = function ($el, value) {
      //         if (value && $el.text() !== value) {
      //           $el.text(value);
      //         }
      //       };

      //       regularTotalPrice = regularTotalPrice != totalPrice && totalPrice > regularTotalPrice ? totalPrice : regularTotalPrice;

      //       $form.find("#eshb-subtotal-price").val(regularTotalPrice);
      //       $form.find("#eshb-discounted-subtotal-price").val(subtotalPrice);
      //       $form.find("#eshb-default-extra-service-price").val(extraServicesPrice);

      //       // update admin booking metaboxes pricing
      //       if (
      //         typeof eshb_ajax.is_admin !== "undefined" &&
      //         eshb_ajax.is_admin
      //       ) {
      //         $('input[name="eshb_booking_metaboxes[total_price]"]').val(
      //           totalPrice
      //         );
      //         $('input[name="eshb_booking_metaboxes[subtotal_price]"]').val(
      //           subtotalPrice
      //         );
      //         $('input[name="eshb_booking_metaboxes[base_price]"]').val(
      //           basePrice
      //         );
      //         $(
      //           'input[name="eshb_booking_metaboxes[extra_service_price]"]'
      //         ).val(extraServicesPrice);
      //         $('input[name="eshb_booking_metaboxes[extra_bed_price]"]').val(
      //           extraBedPrice
      //         );
      //       }

      //       if (currencyPosition == "right") {
      //         totalPrice = totalPrice + currencySymbol;
      //         regularTotalPrice = regularTotalPrice + currencySymbol;
      //       } else {
      //         totalPrice = currencySymbol + totalPrice;
      //         regularTotalPrice = currencySymbol + regularTotalPrice;
      //       }

      //       updateIfChanged(
      //         $form.find("#eshb-booking-discounted-price"),
      //         totalPrice
      //       );
      //       updateIfChanged(
      //         $form.find("#eshb-booking-total-price"),
      //         regularTotalPrice
      //       );
      //     }
      //   }
      // );

      const start = performance.now();

      fetch(`${eshb_rest.root}eshb/v1/booking-prices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": eshb_rest.nonce, // REST API nonce
        },
        body: JSON.stringify({
          accomodationId,
          startDate,
          endDate,
          startTime,
          endTime,
          roomQuantity,
          adultQuantity,
          childrenQuantity,
          extraBedQuantity,
          selectedServices: JSON.stringify(selectedServices),
          nonce: eshb_ajax.nonce, // optional if your REST callback checks it
        }),
      })
        .then((res) => res.json())
        .then((response) => {
          const end = performance.now();
          //console.log(`Response time: ${end - start} ms`);

          if (!response || response.code) {
            // REST API error
            console.error(response.message || "Error fetching booking prices");
            return;
          }

          let prices = response;
          let regularSubtotalPrice = parseFloat(prices.regularSubtotalPrice);
          let subtotalPrice = parseFloat(prices.subtotalPrice);
          let totalPrice = parseFloat(prices.totalPrice);
          let regularTotalPrice = parseFloat(prices.regularTotalPrice);
          let extraServicesPrice = parseFloat(prices.extraServicesPrice);
          let extraBedPrice = parseFloat(prices.extraBedPrice);
          let basePrice = parseFloat(prices.basePrice);
          let currencySymbol = prices.currencySymbol;
          let currencyPosition = prices.currencyPosition;

          // show discounted pricing
          if (totalPrice < regularTotalPrice && totalPrice != regularTotalPrice) {
            $form.find(".cost-calculator-wrapper").addClass("has-discounted-price");
          } else {
            $form.find(".cost-calculator-wrapper").removeClass("has-discounted-price");
          }

          // Conditional DOM updates
          const updateIfChanged = ($el, value) => {
            if (value && $el.text() !== value) {
              $el.text(value);
            }
          };

          regularTotalPrice =
            regularTotalPrice != totalPrice && totalPrice > regularTotalPrice
              ? totalPrice
              : regularTotalPrice;

          $form.find("#eshb-subtotal-price").val(regularTotalPrice);
          $form.find("#eshb-discounted-subtotal-price").val(subtotalPrice);
          $form.find("#eshb-default-extra-service-price").val(extraServicesPrice);

          // update admin booking metaboxes pricing
          if (typeof eshb_rest.is_admin !== "undefined" && eshb_rest.is_admin) {
            $('input[name="eshb_booking_metaboxes[total_price]"]').val(totalPrice);
            $('input[name="eshb_booking_metaboxes[subtotal_price]"]').val(subtotalPrice);
            $('input[name="eshb_booking_metaboxes[base_price]"]').val(basePrice);
            $('input[name="eshb_booking_metaboxes[extra_service_price]"]').val(extraServicesPrice);
            $('input[name="eshb_booking_metaboxes[extra_bed_price]"]').val(extraBedPrice);
          }

          if (currencyPosition === "right") {
            totalPrice = totalPrice + currencySymbol;
            regularTotalPrice = regularTotalPrice + currencySymbol;
          } else {
            totalPrice = currencySymbol + totalPrice;
            regularTotalPrice = currencySymbol + regularTotalPrice;
          }

          updateIfChanged($form.find("#eshb-booking-discounted-price"), totalPrice);
          updateIfChanged($form.find("#eshb-booking-total-price"), regularTotalPrice);
        })
        .catch((err) => {
          console.error("REST API request failed:", err);
        });


    },
    formatPrice: function (totalPrice, currencySymbol = "$") {
      // Check if number has decimal part
      if (totalPrice % 1 === 0) {
        return currencySymbol + totalPrice; // No decimal needed
      } else {
        return currencySymbol + totalPrice.toFixed(2); // Keep 2 decimals
      }
    },
    getDefaultExtraServicesPrice: function () {
      let $form = $(".eshb-booking-form");
      if ($form.length === 0) return 0;

      let extraServicesPrice = 0;

      extraServicesPrice = parseFloat($form.find('input[name="default_extra_service_price"]').val()) || 0;

      return extraServicesPrice;
    },

    calculateExtraServicesPricing: function () {
      let $form = $(".eshb-booking-form");
      if ($form.length === 0) return;

      const getInputVal = (selector) => $form.find(selector).val();
      const getAttr = (selector, attr) => $form.find(selector).attr(attr);

      let startDate = getInputVal('input[name="start_date"]');
      let endDate = getInputVal('input[name="end_date"]');
      let dayCount = moment(endDate).diff(moment(startDate), "days");

      if (dayCount < 1) dayCount = 1;

      let roomCount = parseInt(getInputVal('input[name="room_quantity"]')) || 1;

      let currencySymbol =
        getAttr("#eshb-booking-total-price", "currency_symbol") || "";
      let currentPrice = parseFloat(getInputVal("#eshb-subtotal-price")) || 0;

      let currentDiscountedPrice =
        parseFloat(getInputVal("#eshb-discounted-subtotal-price")) || 0;

      let extraServicesPrice = 0;

      $form.find('input[name="extra_services[]"]:checked').each(function () {
        let $checkbox = $(this);
        let checked = $checkbox.is(":checked");

        if (!checked) return;
        let chargeType = $checkbox.attr("charge_type");
        let periodicity = $checkbox.attr("periodicity");
        let quantity = 1;

        // Quantity input, if available
        let $quantityInput = $checkbox
          .parent()
          .parent()
          .find('input[name="service-quantity"]');

        if ($quantityInput.length && chargeType != "room") {
          quantity = parseInt($quantityInput.val());
        } else if (chargeType == "room") {
          quantity = roomCount;
        }

        // return if quantity == 0
        if (quantity == 0) return;

        let price = parseFloat($checkbox.val()) || 0;

        if (periodicity == "per_day") {
          extraServicesPrice += price * quantity * dayCount;
        } else {
          extraServicesPrice += price * quantity;
        }
      });

      // Subtract default extra services price
      if (0 < ESHBPUBLICBOOKING.getDefaultExtraServicesPrice()) {
        extraServicesPrice = extraServicesPrice - ESHBPUBLICBOOKING.getDefaultExtraServicesPrice();
      }

      // Update total price
      let totalPrice = currentPrice + extraServicesPrice;
      let discountedPrice = currentDiscountedPrice + extraServicesPrice;

      let formattedTotalPrice = ESHBPUBLICBOOKING.formatPrice(
        totalPrice,
        currencySymbol
      );
      let formattedDiscountedPrice = ESHBPUBLICBOOKING.formatPrice(
        discountedPrice,
        currencySymbol
      );

      $form.find("#eshb-booking-total-price").html(formattedTotalPrice);
      $form.find("#eshb-booking-discounted-price").html(formattedDiscountedPrice);
    },
    addToCartReservation: function (that) {
      let form = $(this).parent().parent(),
        accomodationId = $(form)
          .find(".eshb-form-submit-btn")
          .attr("accomodation_id"),
        errWrapper = $(form).find(".eshb-form-err"),
        erroMsg = "",
        submitBtn = $(form).find(".eshb-form-submit-btn"),
        bookingType = $(submitBtn).attr("booking_type"),
        carUrl = eshb_ajax.wooCartUrl,
        selectedServices = ESHBPUBLICBOOKING.getExtraServices(),
        adultQuantity = 1,
        childrenQuantity = 0,
        roomQuantity = 1,
        extraBedQuantity = 0,
        startDate = $(form).find('input[name="start_date"]').val(),
        endDate = $(form).find('input[name="end_date"]').val(),
        startTime = $(form)
          .find('.eshb-time-slot.selected input[name="start_time"]')
          .val(),
        endTime = $(form)
          .find('.eshb-time-slot.selected input[name="end_time"]')
          .val(),
        action = "eshb_add_to_cart_reservation";

      if ($(form).find('input[name="adult_quantity"]').length) {
        adultQuantity = $(form).find('input[name="adult_quantity"]').val();
      }
      if ($(form).find('input[name="children_quantity"]').length) {
        childrenQuantity = $(form)
          .find('input[name="children_quantity"]')
          .val();
      }
      if ($(form).find('input[name="room_quantity"]').length) {
        roomQuantity = $(form).find('input[name="room_quantity"]').val();
      }
      if ($(form).find('input[name="extra_bed_quantity"]').length) {
        extraBedQuantity = $(form)
          .find('input[name="extra_bed_quantity"]')
          .val();
      }

      $(submitBtn).addClass("show-loader");

      let customer = {};

      if (bookingType == "booking_request") {
        action = "eshb_send_reservation_request";


        let customerName = $(form).find('input[name="customer_name"]').val();
        let customerEmail = $(form).find('input[name="customer_email"]').val();
        let customerPhone = $(form).find('input[name="customer_phone"]').val();
        let customerMessage = $(form)
          .find('textarea[name="customer_message"]')
          .val();

        // check if customer name, email, phone is empty
        if (customerName == "" || customerEmail == "" || customerPhone == "") {
          // add error class to the input
          $(form)
            .find('input[name="customer_name"]')
            .addClass("eshb-error-input");
          $(form)
            .find('input[name="customer_email"]')
            .addClass("eshb-error-input");
          $(form)
            .find('input[name="customer_phone"]')
            .addClass("eshb-error-input");

          erroMsg = "Please fill all required fields";
          $(errWrapper).find(".status-failed .status-msg").html(erroMsg);
          $(errWrapper)
            .fadeIn(500)
            .find(".status-failed")
            .css("display", "flex");
          // ajax loader remove
          $(submitBtn).removeClass("show-loader");

          // hide error class and message after 2 seconds
          setTimeout(() => {
            $(form)
              .find('input[name="customer_name"]')
              .removeClass("eshb-error-input");
            $(form)
              .find('input[name="customer_email"]')
              .removeClass("eshb-error-input");
            $(form)
              .find('input[name="customer_phone"]')
              .removeClass("eshb-error-input");
            $(errWrapper).fadeOut(500);
          }, 5000);

          return;
        }

        customer = {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          message: customerMessage,
        };
      }

      $.post(
        eshb_ajax.ajaxurl,
        {
          action: action,
          selectedServices: JSON.stringify(selectedServices),
          accomodationId: accomodationId,
          startDate: startDate,
          endDate: endDate,
          adultQuantity: adultQuantity,
          childrenQuantity: childrenQuantity,
          roomQuantity: roomQuantity,
          extraBedQuantity: extraBedQuantity,
          startTime: startTime,
          endTime: endTime,
          customerInfo: customer,
          nonce: eshb_ajax.nonce,
        },
        function (response) {
          if (response.success == true) {
            erroMsg = response.data.message;

            $(errWrapper).find(".status-success .status-msg").html(erroMsg);
            $(errWrapper)
              .fadeIn(500)
              .find(".status-success")
              .css("display", "flex");

            let timeoutDuration = 2000;
            if (bookingType == "booking_request") {
              timeoutDuration = 20000;

              // clear input fields
              $(form).find('input[name="customer_name"]').val("");
              $(form).find('input[name="customer_email"]').val("");
              $(form).find('input[name="customer_phone"]').val("");
              $(form).find('textarea[name="customer_message"]').val("");
            }

            setTimeout(() => {
              $(errWrapper).fadeOut(500, function () {
                $(errWrapper).find(".status-success").css("display", "none");
              });

              if (bookingType == "woocommerce") {
                location.replace(carUrl);
              } else if (bookingType == "surecart") {
                location.replace(response.data.checkout_url);
              }
            }, timeoutDuration);
          } else if (response.success == false) {
            erroMsg = response.data.error.message;
            console.log('response', response);

            $(errWrapper).find(".status-failed .status-msg").html(erroMsg);
            $(errWrapper)
              .fadeIn(500)
              .find(".status-failed")
              .css("display", "flex");
            setTimeout(function () {
              $(errWrapper).fadeOut(500, function () {
                $(errWrapper).find(".status-failed").css("display", "none");
                $(errWrapper).find(".status-failed .status-msg").html("");
              });
            }, 5000);
          }

          $(submitBtn).removeClass("show-loader");
        }
      );
    },
    closeBookingFormModal: function (e) {
      e.preventDefault();
      $("#easy-hotel-booking-modal").fadeOut();
    },
    openBookingFormModal: function (e) {
      e.preventDefault();
      $("#easy-hotel-booking-modal").fadeIn();
    },
    countriesDataMount: async function () {
      // return if is not admin
      if (typeof eshb_ajax.is_admin !== "undefined" && !eshb_ajax.is_admin) {
        return;
      }

      // return if elements not existing
      if (!document.querySelector("select.eshb-customer-country")) return;

      let currienciesData = await fetch(eshb_ajax.pluginURL + "public/assets/lib/currency.json")
        .then((data) => {
          return data.json();
        })
        .catch((err) => {
          console.log("country fetch error " + err);
        });

      let countriesData = await fetch(eshb_ajax.pluginURL + "public/assets/lib/countries.json")
        .then((data) => {
          return data.json();
        })
        .catch((err) => {
          console.log("country fetch error " + err);
        });

      console.log('currienciesData', currienciesData);
      console.log('countriesData', countriesData);


      const currencySelect = document.querySelector(
        "select.eshb-payment-currency"
      );
      const countrySelect = document.querySelector(
        "select.eshb-customer-country"
      );
      const stateSelect = document.querySelector("select.eshb-customer-state");
      const savedCurrencyValue = currencySelect
        ? currencySelect.getAttribute("data-saved-value")
        : "default";
      const savedCountryValue =
        countrySelect.getAttribute("data-saved-value") || "";
      const savedStateValue =
        stateSelect.getAttribute("data-saved-value") || "";
      //const savedCityValue = citySelect.getAttribute("data-saved-value") || "";

      if (countriesData) {
        // mount country
        countriesData.forEach((country) => {
          const opt = document.createElement("option");
          opt.value = country.code2.trim();
          opt.text = country.name;
          if (savedCountryValue !== "") {
            if (opt.value == savedCountryValue) {
              opt.selected = true;
            }
          }
          countrySelect.appendChild(opt);
        });

        // mount currency
        if (currencySelect) {
          Object.entries(currienciesData).forEach(([code, data]) => {
            const opt = document.createElement("option");
            opt.value = code.trim();
            opt.text = data.name;
            if (savedCurrencyValue !== "") {
              if (opt.value == savedCurrencyValue) {
                opt.selected = true;
              }
            }
            currencySelect.appendChild(opt);
          });
        }

      }

      countrySelect.addEventListener("change", function () {
        const selectedCountryCode = this.value;
        stateSelect.innerHTML = '<option value="">Select State</option>';

        //citySelect.innerHTML = '<option value="">Select City</option>';

        const country = countriesData.find(
          (c) => c.code2 === selectedCountryCode
        );

        if (country && country.states) {
          country.states.forEach((state) => {
            const opt = document.createElement("option");
            opt.value = state.name.trim();
            opt.text = state.name;
            if (savedStateValue !== "") {
              if (opt.value == savedStateValue) {
                opt.selected = true;
              }
            }

            stateSelect.appendChild(opt);
          });
        }
      });

      countrySelect.dispatchEvent(new Event("change"));
    },
    addCustomFieldsToShortcodedForm: function () {
      let form = $(".eshb-booking-form");
      if (form.length === 0) return;

      let bookingFormType = $(form).attr("data-booking-form-type");

      // Helper to get value or default
      const getVal = (selector, def = 0) => {
        const el = $(form).find(selector);
        return el.length ? el.val() : def;
      };

      let customData = {
        accomodation: getVal('input[name="accomodation_title"]', ""),
        start_date: getVal('input[name="start_date"]', ""),
        end_date: getVal('input[name="end_date"]', ""),
        adult_quantity: getVal('input[name="adult_quantity"]', 1),
        children_quantity: getVal('input[name="children_quantity"]', 0),
        room_quantity: getVal('input[name="room_quantity"]', 0),
        extra_bed_quantity: getVal('input[name="extra_bed_quantity"]', 0),
      };

      let extraServicesData = ESHBPUBLICBOOKING.getExtraServices();
      customData.extra_services = extraServicesData
        .map(
          (service) =>
            `${service.title} for ${service.quantity} ${service.chargeType}`
        )
        .join(", ");

      // Define all fields in one array for easy iteration
      const fields = [
        { name: "accomodation", value: customData.accomodation },
        { name: "start_date", value: customData.start_date },
        { name: "end_date", value: customData.end_date },
        { name: "adult_quantity", value: customData.adult_quantity },
        { name: "children_quantity", value: customData.children_quantity },
        { name: "room_quantity", value: customData.room_quantity },
        { name: "extra_bed_quantity", value: customData.extra_bed_quantity },
        { name: "extra_services", value: customData.extra_services },
      ];

      // Helper: check if value is not empty, null, or zero (for numbers)
      const hasValue = (v) =>
        v !== undefined &&
        v !== null &&
        !(typeof v === "number" && v <= 0) &&
        v !== "";

      if (bookingFormType === "cf7") {
        let cf7Form = $(form).find(".wpcf7-form");
        if (cf7Form.length > 0) {
          // Remove all possible fields first
          fields.forEach((f) =>
            cf7Form.find(`input[name="${f.name}"]`).remove()
          );
          // Append only those with values
          fields.forEach((f) => {
            if (hasValue(f.value)) {
              cf7Form.append(
                `<input type="hidden" name="${f.name}" value="${f.value}">`
              );
            }
          });
        }
      } else if (bookingFormType === "fluentform") {
        let fluentformForm = $(form).find(".frm-fluent-form");
        if (fluentformForm.length > 0) {
          fields.forEach((f) => {
            if (hasValue(f.value)) {
              fluentformForm.find(`input[name="${f.name}"]`).val(f.value);
            }
          });
        }
      }
    },
    updateCustomFieldsInShortcodedForm: function () {
      ESHBPUBLICBOOKING.addCustomFieldsToShortcodedForm();
    }
  };

  ESHBPUBLICBOOKING.init();

})(jQuery);
