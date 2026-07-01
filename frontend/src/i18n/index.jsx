import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

const DICT = {
  en: {
    // Brand/Login
    app_tagline: "Book slots without the wait",
    app_subtitle: "Salons, clinics, tutors & more. All in one queue.",
    mobile_number: "Mobile number",
    ten_digit: "10-digit mobile",
    continue: "Continue",
    change_number: "Change number",
    enter_otp: "Enter OTP",
    verify_login: "Verify & Login",
    otp_sent_to: "We sent an OTP to",
    demo_otp: "Demo OTP",
    login_with_pin: "Login with PIN",
    login_with_otp: "Login with OTP",
    enter_pin: "Enter your 4-6 digit PIN",
    set_pin_title: "Set a PIN for quick login",
    set_pin_sub: "Next time you can skip OTP and use your PIN.",
    skip: "Skip",
    save_pin: "Save PIN",
    terms_note: "By continuing, you agree to our Terms & Privacy",
    role_customer: "Customer",
    role_provider: "Service Provider",
    role_assistant: "Service Assistant",
    role_admin: "Admin",
    im_a: "Choose your role",
    book_appointments_seconds: "Book appointments in seconds",
    by_saving_plus: "by Saving Plus",

    // Home
    hello: "Hello",
    skip_wait: "Skip the wait.",
    book_slot: "Book your slot.",
    search_placeholder: "Search salons, clinics, tutors…",
    explore_categories: "Explore Categories",
    top_rated: "Top Rated Near You",
    all_providers: "All Providers",
    no_providers_matching: "No providers found matching",

    // Provider detail
    about: "About",
    services_offered: "Services Offered",
    no_services_listed: "No services listed yet.",
    recent_reviews: "Recent Reviews",
    book_a_slot: "Book a slot",
    currently_unavailable: "Currently unavailable",
    reviews: "reviews",
    from: "from",
    onwards: "onwards",

    // Booking flow
    select_service: "Select service",
    select_date: "Select date",
    select_time: "Select time",
    notes_optional: "Notes (optional)",
    any_specific_request: "Any specific request?",
    confirm: "Confirm",
    select_a_slot: "Select a slot",
    provider_not_available_day: "Provider not available on this day. Try another date.",
    no_open_slots: "No open slots on this day.",
    no_services_available: "No services available",
    vehicle_details: "Vehicle details",
    vehicle_reg_no: "Registration number",
    vehicle_model: "Vehicle model",
    service_type: "Service type",
    booking_failed: "Booking failed",
    booked_token: "Booked! Token",

    // Bookings list
    my_bookings: "My Bookings",
    upcoming: "Upcoming",
    past: "Past",
    no_upcoming_bookings: "No upcoming bookings",
    no_past_bookings: "No past bookings",
    book_slot_to_see: "Book a slot to see it here",
    past_bookings_appear: "Your past bookings will appear here",
    browse_providers: "Browse providers",
    token: "Token",

    // Booking detail
    booking_details: "Booking Details",
    live_token: "Live Token",
    youre_up_next: "You're up next!",
    ahead_of_you: "ahead of you",
    now_serving: "Now serving",
    service: "Service",
    when: "When",
    booked_as: "Booked as",
    amount: "Amount",
    notes: "Notes",
    cancel_booking: "Cancel booking",
    cancel_confirm: "Cancel this booking?",
    booking_cancelled: "Booking cancelled",
    leave_review: "Leave a review",
    share_experience: "Share your experience (optional)",
    submit_review: "Submit review",
    thanks_review: "Thanks for the review!",
    reschedule: "Reschedule",
    reschedule_booking: "Reschedule booking",
    booking_updated: "Booking updated",
    new_date: "New date",
    new_time: "New time",

    // Notifications
    notifications: "Notifications",
    all_caught_up: "You're all caught up",
    no_notifications: "No notifications yet.",

    // Profile
    profile: "Profile",
    name: "Name",
    email: "Email",
    city: "City",
    address: "Address",
    language: "Language",
    save_changes: "Save changes",
    profile_updated: "Profile updated",
    logout: "Logout",
    logout_confirm: "Logout from SlotNow?",
    your_full_name: "Your full name",
    optional: "Optional",
    change_pin: "Change PIN",

    // Provider onboarding / dashboard
    become_provider: "Become a Provider",
    onboarding_intro: "Set up your business profile to start receiving bookings.",
    business_name: "Business name",
    category: "Category",
    bio: "Bio",
    bio_placeholder: "Tell customers about your business",
    save_profile: "Save profile",
    provider_dashboard: "Provider Dashboard",
    today_queue: "Today's Queue",
    on_duty: "On duty",
    off_duty: "Off duty",
    daily_capacity: "Daily capacity",
    services: "Services",
    availability: "Availability",
    add_service: "Add service",
    add_availability: "Add availability window",
    weekday: "Weekday",
    start_time: "Start time",
    end_time: "End time",
    slot_duration_min: "Slot duration (min)",
    max_bookings: "Max bookings",
    duration_min_label: "Duration (min)",
    price: "Price (₹)",
    service_name: "Service name",
    add: "Add",
    call_next: "Call next",
    reset_queue: "Reset queue",
    walk_in: "Walk-in",
    walk_in_customer: "Walk-in customer",
    provider_profile_updated: "Profile saved",
    no_bookings_today: "No bookings today yet.",
    switch_role_login: "Switch to another role by logging in again.",
    remove: "Remove",

    // Weekdays
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  hi: {
    app_tagline: "इंतज़ार के बिना स्लॉट बुक करें",
    app_subtitle: "सैलून, क्लिनिक, ट्यूटर और बहुत कुछ। एक ही क़तार में।",
    mobile_number: "मोबाइल नंबर",
    ten_digit: "10-अंकों का मोबाइल",
    continue: "जारी रखें",
    change_number: "नंबर बदलें",
    enter_otp: "OTP डालें",
    verify_login: "सत्यापित करें और लॉगिन",
    otp_sent_to: "हमने OTP भेजा है",
    demo_otp: "डेमो OTP",
    login_with_pin: "PIN से लॉगिन करें",
    login_with_otp: "OTP से लॉगिन करें",
    enter_pin: "अपना 4-6 अंकों का PIN डालें",
    set_pin_title: "जल्दी लॉगिन के लिए PIN सेट करें",
    set_pin_sub: "अगली बार आप OTP छोड़कर PIN का उपयोग कर सकते हैं।",
    skip: "छोड़ें",
    save_pin: "PIN सहेजें",
    terms_note: "जारी रखकर, आप हमारी शर्तें और गोपनीयता स्वीकार करते हैं",
    role_customer: "ग्राहक",
    role_provider: "सेवा प्रदाता",
    role_assistant: "सेवा सहायक",
    role_admin: "व्यवस्थापक",
    im_a: "अपनी भूमिका चुनें",
    book_appointments_seconds: "पल भर में बुकिंग करें",
    by_saving_plus: "Saving Plus द्वारा",

    hello: "नमस्ते",
    skip_wait: "इंतज़ार छोड़ें।",
    book_slot: "स्लॉट बुक करें।",
    search_placeholder: "सैलून, क्लिनिक, ट्यूटर खोजें…",
    explore_categories: "श्रेणियाँ",
    top_rated: "आपके पास टॉप रेटेड",
    all_providers: "सभी प्रदाता",
    no_providers_matching: "कोई प्रदाता नहीं मिला",

    about: "परिचय",
    services_offered: "सेवाएँ",
    no_services_listed: "अभी कोई सेवा नहीं जोड़ी गई।",
    recent_reviews: "हाल की समीक्षाएँ",
    book_a_slot: "स्लॉट बुक करें",
    currently_unavailable: "अभी उपलब्ध नहीं",
    reviews: "समीक्षाएँ",
    from: "से शुरू",
    onwards: "से",

    select_service: "सेवा चुनें",
    select_date: "तारीख़ चुनें",
    select_time: "समय चुनें",
    notes_optional: "टिप्पणी (वैकल्पिक)",
    any_specific_request: "कोई विशेष अनुरोध?",
    confirm: "पुष्टि करें",
    select_a_slot: "स्लॉट चुनें",
    provider_not_available_day: "इस दिन प्रदाता उपलब्ध नहीं है। दूसरी तारीख़ आज़माएँ।",
    no_open_slots: "इस दिन कोई खाली स्लॉट नहीं है।",
    no_services_available: "कोई सेवा उपलब्ध नहीं",
    vehicle_details: "वाहन विवरण",
    vehicle_reg_no: "पंजीकरण नंबर",
    vehicle_model: "वाहन मॉडल",
    service_type: "सेवा प्रकार",
    booking_failed: "बुकिंग विफल",
    booked_token: "बुक हो गया! टोकन",

    my_bookings: "मेरी बुकिंग्स",
    upcoming: "आगामी",
    past: "पिछली",
    no_upcoming_bookings: "कोई आगामी बुकिंग नहीं",
    no_past_bookings: "कोई पिछली बुकिंग नहीं",
    book_slot_to_see: "यहाँ देखने के लिए स्लॉट बुक करें",
    past_bookings_appear: "आपकी पिछली बुकिंग्स यहाँ दिखेंगी",
    browse_providers: "प्रदाता ब्राउज़ करें",
    token: "टोकन",

    booking_details: "बुकिंग विवरण",
    live_token: "लाइव टोकन",
    youre_up_next: "आपकी बारी अगली है!",
    ahead_of_you: "आपसे आगे",
    now_serving: "अभी सेवा में",
    service: "सेवा",
    when: "कब",
    booked_as: "किसके नाम",
    amount: "राशि",
    notes: "टिप्पणियाँ",
    cancel_booking: "बुकिंग रद्द करें",
    cancel_confirm: "इस बुकिंग को रद्द करें?",
    booking_cancelled: "बुकिंग रद्द",
    leave_review: "समीक्षा दें",
    share_experience: "अपना अनुभव साझा करें (वैकल्पिक)",
    submit_review: "समीक्षा जमा करें",
    thanks_review: "समीक्षा के लिए धन्यवाद!",
    reschedule: "पुनर्निर्धारण",
    reschedule_booking: "बुकिंग पुनर्निर्धारित करें",
    booking_updated: "बुकिंग अपडेट हो गई",
    new_date: "नई तारीख़",
    new_time: "नया समय",

    notifications: "सूचनाएँ",
    all_caught_up: "सभी अपडेट हो गए",
    no_notifications: "अभी कोई सूचना नहीं।",

    profile: "प्रोफ़ाइल",
    name: "नाम",
    email: "ईमेल",
    city: "शहर",
    address: "पता",
    language: "भाषा",
    save_changes: "बदलाव सहेजें",
    profile_updated: "प्रोफ़ाइल अपडेट हो गई",
    logout: "लॉगआउट",
    logout_confirm: "SlotNow से लॉगआउट करें?",
    your_full_name: "आपका पूरा नाम",
    optional: "वैकल्पिक",
    change_pin: "PIN बदलें",

    become_provider: "प्रदाता बनें",
    onboarding_intro: "बुकिंग प्राप्त करने के लिए अपना व्यापार प्रोफ़ाइल सेट करें।",
    business_name: "व्यवसाय का नाम",
    category: "श्रेणी",
    bio: "परिचय",
    bio_placeholder: "ग्राहकों को अपने व्यवसाय के बारे में बताएँ",
    save_profile: "प्रोफ़ाइल सहेजें",
    provider_dashboard: "प्रदाता डैशबोर्ड",
    today_queue: "आज की क़तार",
    on_duty: "ड्यूटी पर",
    off_duty: "ड्यूटी पर नहीं",
    daily_capacity: "दैनिक क्षमता",
    services: "सेवाएँ",
    availability: "उपलब्धता",
    add_service: "सेवा जोड़ें",
    add_availability: "उपलब्धता विंडो जोड़ें",
    weekday: "दिन",
    start_time: "प्रारंभ समय",
    end_time: "समाप्ति समय",
    slot_duration_min: "स्लॉट अवधि (मिनट)",
    max_bookings: "अधिकतम बुकिंग्स",
    duration_min_label: "अवधि (मिनट)",
    price: "मूल्य (₹)",
    service_name: "सेवा का नाम",
    add: "जोड़ें",
    call_next: "अगला बुलाएँ",
    reset_queue: "क़तार रीसेट",
    walk_in: "वॉक-इन",
    walk_in_customer: "वॉक-इन ग्राहक",
    provider_profile_updated: "प्रोफ़ाइल सहेजी गई",
    no_bookings_today: "आज कोई बुकिंग नहीं।",
    switch_role_login: "दूसरी भूमिका में लॉगिन करने के लिए फिर से लॉगिन करें।",
    remove: "हटाएँ",

    weekdays: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { user } = useAuth() || {};
  const [lang, setLang] = useState(() => {
    return (
      localStorage.getItem("slotnow_lang") ||
      (typeof navigator !== "undefined" && navigator.language?.startsWith("hi") ? "hi" : "en")
    );
  });

  // Sync with user preference
  useEffect(() => {
    if (user?.language && (user.language === "en" || user.language === "hi")) {
      if (user.language !== lang) {
        setLang(user.language);
      }
    }
  }, [user?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem("slotnow_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key) => {
      const val = DICT[lang]?.[key];
      if (val !== undefined) return val;
      return DICT.en[key] ?? key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: "en", setLang: () => {}, t: (k) => DICT.en[k] ?? k };
  return ctx;
}
