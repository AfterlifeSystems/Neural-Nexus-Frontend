VITE_DATA_LOADING_API=http://localhost:8060
USER_ID=uEnV9PzXp2cNYFCb7r7ONE4uJ8ME
AVATAR_ID=2e892bc7-2336-4ce9-9c12-19722e0ab27f

curl -X POST \
  "${VITE_DATA_LOADING_API}/init_avatar?user_id=${USER_ID}&avatar_id=${AVATAR_ID}" \                                  
  -H "Content-Type: application/json"
  