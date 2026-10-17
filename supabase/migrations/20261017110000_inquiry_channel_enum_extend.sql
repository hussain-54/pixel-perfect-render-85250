-- =============================================================================
-- Extend inquiry_channel for Front Desk intake form channels
-- Forward-only. Keeps existing 'physical' and 'online' values.
-- =============================================================================

alter type public.inquiry_channel add value if not exists 'phone';
alter type public.inquiry_channel add value if not exists 'whatsapp';
alter type public.inquiry_channel add value if not exists 'referral';
alter type public.inquiry_channel add value if not exists 'education_expo';
alter type public.inquiry_channel add value if not exists 'social_media';
alter type public.inquiry_channel add value if not exists 'other';
