// Supabase project that stores the RSVPs. Paste the Project URL and the
// publishable (or legacy "anon") key from Supabase → Project Settings → API.
// Both are safe to publish: guests can only use the RSVP functions in supabase/schema.sql.
//
// Mailchimp: paste the form "action" URL from Audience → Signup forms → Embedded forms
// (looks like https://jk44studio.us21.list-manage.com/subscribe/post?u=...&id=...).
// Optional: the tag id from the same embed code (hidden input name="tags") to tag guests.
window.RSVP_CONFIG = {
  supabaseUrl: "https://emjykorcvgukiaxpyunn.supabase.co",
  supabaseKey: "sb_publishable_NSJwJP-j-lXmj-bHx2yR4A_kPyQQnGV",
  mailchimpForm: "https://landofride.us1.list-manage.com/subscribe/post?u=7f9103b4d1ba3374b8c63b70b&id=3afbf7f037&f_id=00bdede4f0",
  mailchimpTags: "6403441"  // Cinema Night Madrid 2026
};
