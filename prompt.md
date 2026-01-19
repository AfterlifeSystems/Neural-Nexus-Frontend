# viewing documents display but do not persist on load of Avatar settings
# persistent login across refresh and browser navigation
# image upload
# audio upload
# name visible and able to change
# description visible and able to change

# social media accounts don't connect
# only accepts a single type of document (text Q & A)
# Live mode does not work

# Messages do not populate 
# deleting the avatar
# logging out
# vanta background is slow to load
# color scheme could be updated
# No loading indicator for message replys
# User account settings and billing does not function
# no option to share avatars or create proprietary avatars that are populated and shared


# Model does not have presence of self. need to establish internal persona characteristics, external persona characteristics, psycho linguistic characteristics of speech


Prioritize foundational fixes for stability and core user flow:

Persistent login across refresh and browser navigation – Essential for sessions; implement with JWT or localStorage.
Logging out – Pairs with login; simple endpoint and clear session.
Name visible and able to change – Quick UI/backend update for basic editing.
Description visible and able to change – Similar to name; build on it.
Image upload – Core avatar feature; use multer or similar for handling.
Audio upload – Follow image pattern.

Tackle these in sequence tonight for quick wins. Defer UI polish (vanta, colors, indicators) and advanced features (social, sharing, model persona) until basics work. Test each change locally.