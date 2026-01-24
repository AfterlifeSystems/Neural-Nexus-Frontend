<!-- bugs.md -->
data loading api will not allow connections (initializations) while processing documents. 

why doesnt the enter key hit enter on the create avatar modal? I am pressing enter while cancel and create are highlighted, but the model does not perform a button press. 

data is not deleted in firestore or storage after deleting

i need to be able to delete documents from both the firestore and the chromadb vectorstore
i need to be able to see toasts or loading indicators about what is going on with the application.

name does not populate on user settings button pop up on first render after creating an account

navigating away from avatar settings does not continue to process uploaded documents.
cannot see all of input bar because of loading toast for uploaded document


# Conversation Notes
Wow no I didn't mention any othe above... you need a lot of work on short term memory, long term memory, and identity for starters

no loading spinner...
would like to use on_snapshot methods for live streams of data from firestore

integrate user_state_manager calls in either this react application or by calling the messaging api

live mode needs audio transcription
live mode button doesn't function
need to use vllm inference provider
need to calculate cost of customer acquisition, cost of avatar, cost per message.

There is lots to do. not a mess. work in progress. I see the entire application...

social media logins dont work

uploaded documents do not get analyzed by data loading api
data loading api needs to analyze all types of scenarios
psycho analysis of documents needs to be performed on data-loading api and the active avatar needs to be updated with those insights for prompt injection

need to create personality safeguards on the model to allow the model to have a sense of self and not make claims assuming likeness of another without that user's permission.

live mode needs live audio transcription
authentic voices integration with live kit or eleven labs
generated images and video syncopated with generated text

api for responses for integrations with messaging application to make bots for twitch, discord, slack, automated email responses, automated voice agents to handle calls, etc.... shivon zilis's ideas on presenting links for presentations and offering video suggestions in chat. 

need commentary on non-image files uploaded to chat

chat does not currently accept media
need limit of file size uploaded to chat to be 25 MB
need to limit number of files to 9.

need a new inference endpoint for structured json query response for data loading api rather than free-tier dev key 

need to test multiple simultaneous users
need to deploy to production for frontend, chromadb, data-loading, and messaging api

need to create resources to train adapters
need to create process to attach adapters
need to create method of processing data from chatgpt, grok, and claude and neural nexus to allow for adapter training. very worthwhile; chain of thought reasoning patterns massive amount of data. scales beyond retrieval augmented generation

need a universal metric of authenticity to evaluate responses from llm and ensure the llm is true-to-life.
