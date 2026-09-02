delete on mobile was an accident; needs prompt or different button sizing
selecting media from phone is not functional (should be able to connect mcp phone and perform an initial pull then on updates new data is pulled and stored to a limit)

duplicate toasts on media upload
adding the url will immediately upload new media (before pressing the button); furthermore, the media is not actually uploaded with the backend api endpoint
there is no way to upload multiple urls
there is no demarkation for if an image is a reference image or reference audio
there is no way to upload reference audio in the frontend
403 response on wrong password for the toast rather than the actual "incorrect password"
DELETE ACCOUNT takes a moment; user should be logged out and redirected immediately


cannot add a reference image from a url
uploading data in the UI should have a progress bar for the media item that is being uploaded implemented the UI; the length of the video/audio is the approximate total time to distil the media into text

no way to add reference audio from a file from the UI

# BUG there is a delay in image of avatar in the chat message area

the message area needs metrics of time, tokens, and cost from the api
message area USER MESSAGE needs edit, copy, accept and decline edit, REFRESH/RETRY
message area AVATAR RESPONSE needs rate (binary); copy, share, regenerate/RETRY, feedback/report, SPEAK ALOUD (TEXT TO SPEACH/WILL PROMPT FOR AVATAR IVC CREATION IF THERE IS NO REFERENCE AUDIO OR CREATE REFERENCE AUDIO IF THE PERSONAL AVATAR)
conversations needs rename and delete and pin and share (thread (not-editable))
conversation suggestions are a clickable message window within the chat of the user before sending a message in the chat window

I need to be able to connect to data servers with one click in avatar settings

reference image should create 6s neutral looping video with fidgeting

data should have a search bar with filter by type
there should be a suggested generated description after media is uploaded (press a button to generate a description based on the available media/regenerate the description)