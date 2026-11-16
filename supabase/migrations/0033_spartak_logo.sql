-- Spartak's logo and phone icons were uploaded to club-assets/<club_id>/
-- (same file names the Hub's Branding tab writes). Point the club at them.
update clubs set logo_path = 'logo.png?v=20261116' where slug = 'spartak';
