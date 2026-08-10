I am no longer using Firebase nor supabase.
Please view the repositories but do not alter the codebase. Only use the following as reference.

# API
/home/user/gh/anubis-project/anubis

# Thin Python Frontend
/home/user/gh/anubis-project/anubis/frontend

I need this to integrate with the API, there are now endpoints for viewing documents, uploading, downloading, and messaging.
There needs to be a login and signup experience, the QR code on each page that routes to neuralnexus.site/welcome.
ALL API ENDPOINTS NEED TO BE INTEGRATED INTO THE FRONTEND WHERE THIS MAKES SENSE TO ALLOW FOR THE SAME CAPABILITY AS THE CURRENT STREAMLIT APPLICATION AND THE CURRENT CAPABILITIES OF THIS REPOSITORY.

# KEEP THE FUTURE FEATURES IN MIND WHEN DEVELOPING:
There will be features in the future for geo-location related avatar services.
There is onboarding as detailed in /home/user/gh/anubis-project/Neural-Nexus-Frontend/_ONBOARDING_EXPERIENCE_FEATURE.md

There will be camera-related login/ new-user awareness leading to onboarding and signup. 

Geo-location enabled in this web app pulls the messaging for logged in users through facial recognition to the LLM of the location (LLM ordering for fast food restaraunts, Pastors or other pertinent avatars for other in-person locations)

new-user awareness brought upon by the facial recognition login always starts the new-user onboarding walkthrough then re-routes per geo-location (regular neural nexus for non geo-fenced locations; llm serving skip-the-line order placement, pastors or religious figures, interactive exhibits AVINA-like virtual presence, Museum, walking path facts, service members, user-created geo-located avatars, etc.)