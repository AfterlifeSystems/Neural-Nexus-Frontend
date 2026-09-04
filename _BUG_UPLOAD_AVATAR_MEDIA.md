
selecting media from phone is not functional (should be able to connect mcp phone and perform an initial pull then on updates new data is pulled and stored to a limit)

duplicate toasts on media upload

adding the url will immediately upload new media (before pressing the button); furthermore, the media is not actually uploaded with the backend api endpoint
there is no way to upload multiple urls

there is no way to upload reference audio in the frontend

403 response on wrong password for the toast rather than the actual "incorrect password"
DELETE ACCOUNT takes a moment; user should be logged out and redirected immediately


cannot add a reference image from a url
uploading data in the UI should have a progress bar for the media item that is being uploaded implemented the UI; the length of the video/audio is the approximate total time to distil the media into text

no way to add reference audio from a file from the UI

# BUG there is a delay in image of avatar in the chat message area

the message area needs metrics of time, tokens, and cost from the api
message area USER MESSAGE needs edit, copy, accept and decline edit, REFRESH/RETRY
message area AVATAR RESPONSE needs rate (binary); copy, share, regenerate/RETRY, feedback/report, 

conversations needs rename and delete and pin and share (thread (not-editable))
conversation suggestions are a clickable message window within the chat of the user before sending a message in the chat window

message area avatar response: SPEAK ALOUD (TEXT TO SPEECH/WILL PROMPT FOR AVATAR IVC CREATION IF THERE IS NO REFERENCE AUDIO OR CREATE REFERENCE AUDIO IF THE PERSONAL AVATAR)

I need to be able to connect to data servers with one click in avatar settings

reference image should create 6s neutral looping video with fidgeting/neutral idling 

there should be a suggested generated description after media is uploaded (press a button to generate a description based on the available media/regenerate the description (uses the avatar to generate a description; sends a prompt to the avatar to retrieve a response))




further more there needs to be the following API endpoint creation and frontend usage for instant voice cloning and reference images;
  '/home/user/gh/anubis-project/wt/f-anubis-discord/_EMOTION_MEDIA_GENERATION_COST_REPORT.md' When a reference image is uploaded, the reference image is used as a neutral emotion, there
  are 7 6second videos to be created; 6 (one for each emotion generated from the reference image) images using the xai api, and 7 6 second looping videos generated from the xai api where
  there is fidgeting/idling for the emotion (one for each emotion and the first and last frames end on the "seed" image); to reiterate, the reference image is uploaded, 6 emotion images
  are created from the reference image which will be used in the message area when the sentiment is sufficiently triggered in chat, and 7 6 second videos that loop to start and end at the
  same position to allow for continuous illusion of idling/fidgeting while in that emotion are created and stored in the postgres database per user avatar; when reference audio is created,
  the 1 minute of reference audio at least needs to be defined while ultimately 2 minutes should be obtained of solely the avatar speaking to create instant voice cloning with elevenlabs;
  when video or audio is additionally added of the PERSONAL AVATAR ONLY, additional reference audio clips should be collected until there is 30 minutes of audio at minimum for professional voice cloning with elevenlabs; this should continue until there is between 30 minutes to 180 minutes of audio of ONLY the PERSONAL AVATAR (no other speakers etc.) from uploaded audio/video media (this should happen during the update_avatar_identity_with_media process naturally). these audio clips should be stored and only contain the avatar speaking (the source clips may have multiple speakers... only the avatars voice should be used for professional voice cloning and this should already be handled in the update_avatar_identity_with_media pipeline); after 30 minutes of clips of the personal avatar have been collected, a training job should trigger for professional voice cloning (takes 3 to 6 hours) and when the professional voice clone has been created, this voice should be used in place of the instant voice clone. 
