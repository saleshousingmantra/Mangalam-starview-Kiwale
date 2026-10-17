/**
 * ==========================================================
 * FORM.JS
 * Mangalam Starview — Kiwale, Pune
 *
 * Handles:
 *  - Supabase connection (credentials come from config.js)
 *  - Enquiry form validation
 *  - Form submission (works for the footer form and the popup form)
 *  - Double-submit protection
 *  - Error focus + scroll
 *  - Success message
 *  - Email to the Relationship Manager (send-enquiry-email Edge Function)
 *  - Thank-you page redirect
 *
 * Load order in index.html:
 *   1. Supabase JS SDK (CDN)
 *   2. config.js
 *   3. form.js   <-- this file
 *   4. index.js
 * ==========================================================
 */

document.addEventListener("DOMContentLoaded", function () {

    "use strict";

    /* =====================================================
       READ CONFIG (from config.js — never hardcoded here)
    ===================================================== */

    const CONFIG = window.SITE_CONFIG || {};

    const SUPABASE_URL = CONFIG.SUPABASE_URL;
    const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
    const EMAIL_FUNCTION_NAME = CONFIG.EMAIL_FUNCTION_NAME;
    const SUPABASE_TABLE = CONFIG.SUPABASE_TABLE || "enquiries";
    const DEFAULT_PROJECT_NAME = CONFIG.PROJECT_NAME || "Mangalam Starview, Kiwale, Pune";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("Missing Supabase config. Make sure config.js is loaded before form.js.");
        return;
    }

    /* =====================================================
       CHECK SUPABASE LIBRARY
    ===================================================== */

    if (!window.supabase) {
        console.error("Supabase JS library is not loaded.");
        return;
    }

    /* =====================================================
       CREATE SUPABASE CLIENT
    ===================================================== */

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    console.log("Supabase form system initialized.");

    /* =====================================================
       ERROR FOCUS + SCROLL
    ===================================================== */

    function getErrorEl(field) {
        if (!field || !field.id) return null;
        return document.getElementById(field.id + "-error");
    }

    function showFieldError(field, message) {
        if (!field) {
            alert(message);
            return;
        }

        field.classList.add("is-invalid");
        field.setAttribute("aria-invalid", "true");

        const errorEl = getErrorEl(field);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add("active");
            field.setAttribute("aria-describedby", errorEl.id);
        }
    }

    function clearFieldError(field) {
        if (!field) return;

        field.classList.remove("is-invalid");
        field.removeAttribute("aria-invalid");

        const errorEl = getErrorEl(field);
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.classList.remove("active");
        }
    }

    function focusAndScroll(field, message) {
        if (!field) {
            alert(message);
            return;
        }

        showFieldError(field, message);

        field.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(function () {
            field.focus();
        }, 500);
    }

    /* Clear a field's inline error as soon as the person starts
       correcting it, so the message doesn't linger after they fix it. */
    document.querySelectorAll('form input, form select').forEach(function (field) {
        var evt = field.tagName === "SELECT" ? "change" : "input";
        field.addEventListener(evt, function () {
            clearFieldError(field);
        });
    });

    /* =====================================================
       SUCCESS MESSAGE
       Looks for a .success-message next to the form first,
       falls back to #successMessage for older markup.
    ===================================================== */

    function showSuccessMessage(form) {
        let message = null;

        if (form && form.parentElement) {
            message = form.parentElement.querySelector(".success-message");
        }

        if (!message) {
            message = document.getElementById("successMessage");
        }

        if (message) {
            message.classList.add("active");
            form.style.display = "none";

            setTimeout(function () {
                message.classList.remove("active");
                form.style.display = "";
            }, 6000);
        }
    }

    /* =====================================================
       SEND EMAIL NOTIFICATION
    ===================================================== */

    async function sendEmailNotification(name, phone, email, interest, project, developer, managerName, managerEmail, source, sourceLink) {
        try {
            console.log("Sending email notification...");

            if (!EMAIL_FUNCTION_NAME) {
                console.warn("EMAIL_FUNCTION_NAME not set in config.js — skipping email notification.");
                return false;
            }

            /*
             * The send-enquiry-email Edge Function emails the
             * enquiry to the Relationship Manager via Brevo.
             * It only sends to RM addresses allow-listed in its
             * secrets, so manager_email here cannot redirect the
             * email anywhere else (see the function's header).
             */

            const { error } = await supabaseClient.functions.invoke(EMAIL_FUNCTION_NAME, {
                body: {
                    name: name,
                    phone: phone,
                    email: email || "",
                    interest: interest || "",
                    project: project || DEFAULT_PROJECT_NAME,
                    developer: developer || "",
                    manager_name: managerName || "",
                    manager_email: managerEmail || "",
                    source: source || "",
                    source_link: sourceLink || ""
                }
            });

            if (error) throw error;

            console.log("Email notification sent.");
            return true;

        } catch (error) {
            console.error("Email notification error:", error);

            /*
             * Do not block the user's enquiry — the record has
             * already been saved successfully in Supabase.
             */
            return false;
        }
    }

    /* =====================================================
       FORM SUBMISSION
    ===================================================== */

    const forms = document.querySelectorAll("form");

    if (!forms.length) {
        console.warn("No forms found on this page.");
        return;
    }

    /* =====================================================
       SUBMIT BUTTON — disabled until every mandatory field
       is filled in and valid, so the button itself signals
       whether the form is ready to send.
    ===================================================== */

    function formIsReady(form) {
        const name = form.querySelector('[name="name"]')?.value.trim() || "";
        const phone = form.querySelector('[name="phone"]')?.value.trim() || "";
        const email = form.querySelector('[name="email"]')?.value.trim() || "";
        const interest = form.querySelector('[name="interest"]')?.value.trim() || "";

        return (
            name.length >= 3 &&
            /^[6-9][0-9]{9}$/.test(phone) &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
            interest.length > 0
        );
    }

    function updateSubmitState(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (!submitButton) return;

        const ready = formIsReady(form);
        submitButton.disabled = !ready;
        submitButton.setAttribute("aria-disabled", String(!ready));
    }

    forms.forEach(function (form) {
        /* Start disabled, then check right away in case the browser has
           already autofilled the fields (e.g. saved form data). */
        updateSubmitState(form);

        ["name", "phone", "email", "interest"].forEach(function (fieldName) {
            const field = form.querySelector('[name="' + fieldName + '"]');
            if (!field) return;
            const evt = field.tagName === "SELECT" ? "change" : "input";
            field.addEventListener(evt, function () {
                updateSubmitState(form);
            });
        });
    });

    forms.forEach(function (form) {

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            /* PREVENT MULTIPLE SUBMISSIONS */
            if (form.dataset.submitting === "true") {
                console.log("Submission already in progress.");
                return;
            }

            /* GET FORM FIELDS */
            const nameInput = form.querySelector('[name="name"]');
            const phoneInput = form.querySelector('[name="phone"]');
            const emailInput = form.querySelector('[name="email"]');
            const interestInput = form.querySelector('[name="interest"]');
            const projectInput = form.querySelector('[name="project"]');
            const developerInput = form.querySelector('[name="developer"]');
            const managerNameInput = form.querySelector('[name="manager_name"]');
            const managerEmailInput = form.querySelector('[name="manager_email"]');
            const sourceInput = form.querySelector('[name="source"]');
            const sourceLinkInput = form.querySelector('[name="source_link"]');
            const submitButton = form.querySelector('button[type="submit"]');

            /* GET VALUES */
            const name = nameInput?.value.trim() || "";
            const phone = phoneInput?.value.trim() || "";
            const email = emailInput?.value.trim() || "";
            const interest = interestInput?.value.trim() || "";
            const project = projectInput?.value.trim() || DEFAULT_PROJECT_NAME;
            const developer = developerInput?.value.trim() || CONFIG.DEFAULT_DEVELOPER_NAME || "";
            const managerName = managerNameInput?.value.trim() || "";
            const managerEmail = managerEmailInput?.value.trim() || "";
            /* Where the lead came from (index.js fills these — see the
               first-touch attribution block there). Fall back to the
               current page URL for source_link if index.js hasn't run
               for some reason, so the field is never silently empty. */
            const source = sourceInput?.value.trim() || "Direct / None";
            const sourceLink = sourceLinkInput?.value.trim() || window.location.href;

            /* Clear any errors left over from a previous attempt. */
            [nameInput, phoneInput, emailInput, interestInput].forEach(clearFieldError);

            /* VALIDATE NAME — MANDATORY */
            if (name.length < 3) {
                focusAndScroll(nameInput, "Please enter your full name.");
                return;
            }

            /* VALIDATE PHONE — MANDATORY */
            if (!/^[6-9][0-9]{9}$/.test(phone)) {
                focusAndScroll(
                    phoneInput,
                    "Please enter a valid 10-digit mobile number."
                );
                return;
            }

            /* VALIDATE EMAIL — MANDATORY */
            if (!email) {
                focusAndScroll(emailInput, "Please enter your email address.");
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                focusAndScroll(emailInput, "Please enter a valid email address.");
                return;
            }

            /* VALIDATE INTEREST — MANDATORY */
            if (!interest) {
                focusAndScroll(interestInput, "Please select what you're interested in.");
                return;
            }

            /* LOCK FORM */
            form.dataset.submitting = "true";

            const originalButtonText = submitButton
                ? submitButton.textContent.trim()
                : "Submit";

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Submitting...";
                submitButton.setAttribute("aria-disabled", "true");
                submitButton.style.cursor = "not-allowed";
            }

            /* SUPABASE INSERT */
            try {
                console.log("Submitting enquiry to Supabase...");

                const { error } = await supabaseClient
                    .from(SUPABASE_TABLE)
                    .insert({
                        name: name,
                        phone: phone,
                        email: email || null,
                        interest: interest || null,
                        project: project,
                        developer: developer || null,
                        manager_name: managerName || null,
                        manager_email: managerEmail || null,
                        source: source || null,
                        source_link: sourceLink || null
                    });

                if (error) {
                    console.error("Supabase Error:", error);

                    const detail = [error.message, error.details, error.hint]
                        .filter(Boolean)
                        .join(" — ");

                    throw new Error(detail || "Unable to submit enquiry.");
                }

                console.log("Enquiry successfully saved in Supabase.");

                /*
                 * Let other scripts (index.js) react to a successful
                 * submit — e.g. the popup uses this to open WhatsApp
                 * or place a call, but only now that the enquiry is
                 * actually confirmed saved, never before.
                 */
                form.dispatchEvent(new CustomEvent("enquirySubmitted", {
                    bubbles: true,
                    detail: {
                        name: name,
                        phone: phone,
                        email: email,
                        interest: interest,
                        project: project,
                        managerName: managerName,
                        managerEmail: managerEmail
                    }
                }));

                await sendEmailNotification(name, phone, email, interest, project, developer, managerName, managerEmail, source, sourceLink);

                showSuccessMessage(form);
                form.reset();
                [nameInput, phoneInput, emailInput, interestInput].forEach(clearFieldError);
                updateSubmitState(form);

                setTimeout(function () {
                    window.location.href = "thankyou.html";
                }, 1500);

            } catch (error) {
                console.error("Submission Error:", error);

                alert(
                    error.message ||
                        "Unable to submit your enquiry. Please try again."
                );

            } finally {
                form.dataset.submitting = "false";

                if (submitButton) {
                    submitButton.textContent = originalButtonText;
                    submitButton.style.cursor = "";
                    /* Re-evaluate rather than force-enable: after a
                       successful submit the form has just been reset
                       (empty again, correctly disabled); after a failed
                       submit the person's data is still in the fields,
                       so this correctly leaves it enabled. */
                    updateSubmitState(form);
                }
            }
        });
    });

    /* =====================================================
       PHONE INPUT — ALLOW ONLY NUMBERS
    ===================================================== */

    document.querySelectorAll('input[name="phone"]').forEach(function (input) {
        input.addEventListener("input", function () {
            this.value = this.value.replace(/[^0-9]/g, "");

            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
        });
    });

    console.log("Form.js loaded successfully.");
});
