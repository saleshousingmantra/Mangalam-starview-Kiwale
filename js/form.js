/**
 * ==========================================================
 * FORM.JS
 
 * Handles:
 *  - Supabase connection
 *  - Enquiry form validation
 *  - Form submission
 *  - Double-submit protection
 *  - Error focus + scroll
 *  - Success message
 *  - Google Apps Script email notification
 *  - Thank-you page redirect
 * ==========================================================
 */

document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    /* =====================================================
       SUPABASE CONFIGURATION
    ===================================================== */

    const SUPABASE_URL =
        "https://rgzpytocxhjzxsopkrmu.supabase.co";

    const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnenB5dG9jeGhqenhzb3Brcm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Mjg0MDcsImV4cCI6MjEwMTUwNDQwN30.pMm_t48EOxFd2pnbu2gy4y7EK8fzmem3H4zbbpiqNJ4";


    /* =====================================================
       GOOGLE APPS SCRIPT EMAIL SERVICE
    ===================================================== */

    const EMAIL_SERVICE_URL =
        "https://script.google.com/macros/s/AKfycby9AvGtTt3mNDSfOX3kuJfgqyy7z8a40ZH_U2JAA80NEAAVOw7-l0iiy5FBZKiSeRuy/exec";


    /* =====================================================
       CHECK SUPABASE LIBRARY
    ===================================================== */

    if (!window.supabase) {

        console.error(
            "Supabase JS library is not loaded."
        );

        return;
    }


    /* =====================================================
       CREATE SUPABASE CLIENT
    ===================================================== */

    const supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );


    console.log(
        "Supabase form system initialized."
    );


    /* =====================================================
       ERROR FOCUS + SCROLL
    ===================================================== */

    function focusAndScroll(field, message) {

        if (!field) {

            alert(message);

            return;
        }


        field.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });


        setTimeout(function () {

            field.focus();

        }, 500);


        alert(message);
    }


    /* =====================================================
       SUCCESS MESSAGE
    ===================================================== */

    function showSuccessMessage(form) {

        let message = null;


        if (form && form.parentElement) {

            message =
                form.parentElement.querySelector(
                    ".success-message"
                );
        }


        if (!message) {

            message =
                document.getElementById(
                    "successMessage"
                );
        }


        if (message) {

            message.classList.add("show");


            setTimeout(function () {

                message.classList.remove(
                    "show"
                );

            }, 4000);
        }
    }


    /* =====================================================
       SEND EMAIL NOTIFICATION
    ===================================================== */

    async function sendEmailNotification(
        name,
        phone,
        email,
        interest
    ) {

        try {

            console.log(
                "Sending email notification..."
            );


            /*
             * Google Apps Script is being used only
             * as an email notification service.
             *
             * no-cors is used because Google Apps Script
             * may not return normal browser CORS headers.
             *
             * We therefore do NOT try to read the response.
             */

            await fetch(
                EMAIL_SERVICE_URL,
                {
                    method: "POST",

                    mode: "no-cors",

                    headers: {
                        "Content-Type":
                            "text/plain;charset=utf-8"
                    },

                    body: JSON.stringify({

                        name: name,

                        phone: phone,

                        email:
                            email ||
                            "",

                        interest:
                            interest ||
                            ""

                    })
                }
            );


            console.log(
                "Email notification request sent."
            );


            return true;


        } catch (error) {

            console.error(
                "Email notification error:",
                error
            );


            /*
             * Do not stop the user's enquiry.
             *
             * The data has already been saved
             * successfully in Supabase.
             */

            return false;
        }
    }


    /* =====================================================
       FORM SUBMISSION
    ===================================================== */

    const forms =
        document.querySelectorAll("form");


    if (!forms.length) {

        console.warn(
            "No forms found on this page."
        );

        return;
    }


    forms.forEach(function (form) {


        /* =================================================
           SUBMIT EVENT
        ================================================= */

        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                /* =========================================
                   PREVENT MULTIPLE SUBMISSIONS
                ========================================= */

                if (
                    form.dataset.submitting ===
                    "true"
                ) {

                    console.log(
                        "Submission already in progress."
                    );

                    return;
                }


                /* =========================================
                   GET FORM FIELDS
                ========================================= */

                const nameInput =
                    form.querySelector(
                        '[name="name"]'
                    );


                const phoneInput =
                    form.querySelector(
                        '[name="phone"]'
                    );


                const emailInput =
                    form.querySelector(
                        '[name="email"]'
                    );


                const interestInput =
                    form.querySelector(
                        '[name="interest"]'
                    );


                const submitButton =
                    form.querySelector(
                        'button[type="submit"]'
                    );


                /* =========================================
                   GET VALUES
                ========================================= */

                const name =
                    nameInput?.value.trim() || "";


                const phone =
                    phoneInput?.value.trim() || "";


                const email =
                    emailInput?.value.trim() || "";


                const interest =
                    interestInput?.value.trim() || "";


                /* =========================================
                   VALIDATE NAME
                ========================================= */

                if (name.length < 3) {

                    focusAndScroll(
                        nameInput,
                        "Please enter your full name."
                    );

                    return;
                }


                /* =========================================
                   VALIDATE PHONE
                ========================================= */

                if (
                    !/^[6-9][0-9]{9}$/.test(
                        phone
                    )
                ) {

                    focusAndScroll(
                        phoneInput,
                        "Please enter a valid 10-digit mobile number."
                    );

                    return;
                }


                /* =========================================
                   VALIDATE EMAIL
                   EMAIL IS OPTIONAL
                ========================================= */

                if (
                    email &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                        email
                    )
                ) {

                    focusAndScroll(
                        emailInput,
                        "Please enter a valid email address."
                    );

                    return;
                }


                /* =========================================
                   LOCK FORM
                ========================================= */

                form.dataset.submitting =
                    "true";


                const originalButtonText =
                    submitButton
                        ? submitButton.textContent.trim()
                        : "Register Your Interest";


                /* =========================================
                   DISABLE SUBMIT BUTTON
                ========================================= */

                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        "Submitting...";

                    submitButton.setAttribute(
                        "aria-disabled",
                        "true"
                    );

                    submitButton.style.cursor =
                        "not-allowed";
                }


                /* =========================================
                   SUPABASE INSERT
                ========================================= */

                try {

                    console.log(
                        "Submitting enquiry to Supabase..."
                    );


                    const { error } =
                        await supabaseClient
                            .from("enquiries")
                            .insert({

                                name: name,

                                phone: phone,

                                email:
                                    email ||
                                    null,

                                interest:
                                    interest ||
                                    null

                            });


                    /* =====================================
                       CHECK SUPABASE ERROR
                    ===================================== */

                    if (error) {

                        console.error(
                            "Supabase Error:",
                            error
                        );

                        throw new Error(
                            error.message ||
                            "Unable to submit enquiry."
                        );
                    }


                    console.log(
                        "Enquiry successfully saved in Supabase."
                    );


                    /* =====================================
                       SEND EMAIL
                    ===================================== */

                    await sendEmailNotification(
                        name,
                        phone,
                        email,
                        interest
                    );


                    /* =====================================
                       SHOW SUCCESS
                    ===================================== */

                    showSuccessMessage(form);


                    /* =====================================
                       RESET FORM
                    ===================================== */

                    form.reset();


                    /* =====================================
                       REDIRECT
                    ===================================== */

                    setTimeout(
                        function () {

                            window.location.href =
                                "thankyou.html";

                        },
                        1000
                    );


                } catch (error) {

                    /* =====================================
                       ERROR
                    ===================================== */

                    console.error(
                        "Submission Error:",
                        error
                    );


                    alert(
                        error.message ||
                        "Unable to submit your enquiry. Please try again."
                    );


                } finally {

                    /* =====================================
                       UNLOCK FORM
                    ===================================== */

                    form.dataset.submitting =
                        "false";


                    /* =====================================
                       RESTORE BUTTON
                    ===================================== */

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.removeAttribute(
                            "aria-disabled"
                        );

                        submitButton.textContent =
                            originalButtonText;

                        submitButton.style.cursor =
                            "";
                    }
                }

            }
        );

    });


    /* =====================================================
       PHONE INPUT
       ALLOW ONLY NUMBERS
    ===================================================== */

    const phoneInputs =
        document.querySelectorAll(
            'input[name="phone"]'
        );


    phoneInputs.forEach(function (input) {

        input.addEventListener(
            "input",
            function () {

                this.value =
                    this.value.replace(
                        /[^0-9]/g,
                        ""
                    );


                if (
                    this.value.length > 10
                ) {

                    this.value =
                        this.value.slice(
                            0,
                            10
                        );
                }
            }
        );

    });


    console.log(
        "Form.js loaded successfully."
    );

});