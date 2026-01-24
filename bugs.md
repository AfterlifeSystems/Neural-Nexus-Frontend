<!-- bugs.md -->
data loading api will not allow connections (initializations) while processing documents. 

why doesnt the enter key hit enter on the create avatar modal? I am pressing enter while cancel and create are highlighted, but the model does not perform a button press. 

data is not deleted in firestore or storage after deleting

i need to be able to delete documents from both the firestore and the chromadb vectorstore
i need to be able to see toasts or loading indicators about what is going on with the application.

name does not populate on user settings button pop up on first render after creating an account

navigating away from avatar settings does not continue to process uploaded documents.
cannot see all of input bar because of loading toast for uploaded document

if documents are too large the data-loading api fails to process the document into a vectorstore or analyze the content

documents with newline characters or '' will not process.

# Conversation Notes
Wow no I didn't mention any othe above... you need a lot of work on short term memory, long term memory, and identity for starters

no loading spinner...
would like to use on_snapshot methods for live streams of data from firestore

integrate user_state_manager calls in either this react application or by calling the messaging api

live mode needs audio transcription
live mode button doesn't function
need to use vllm inference provider
need to calculate cost of customer acquisition, cost of avatar, cost per message.
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
need to create reference image and reference audio

need to create text from reference image and reference audio

need to use reference audio to identify user in video 
need to be able to acquire data from youtube videos

need to be able to allow for the avatar to query first.

need to create community avatars (Evan Woods is the first community avatar... I am sharing the avatar of myself with the rest of the world. anyone can talk to my avatar and anyone can also share their own personal avatar. )

need to create proprietary avatars for businesses and services. agentic ordering. place for prayers.

I want to create Mom, Place-for-prayers, myself, elon musk, shivon zilis, gracie abrams, lex fridman so he can interview himself

need to be able to delete avatar
need to be able to update user information
need to rate limit usage
need to offer subscriptions and tiers of use
need to integrate subscriptable automation of personal avatars
need users

need a different color scheme.

There is so much to do:
Atomic Parts for authentic LLMS
Linguistic: Vocabulary size, syntax patterns sentiment lexicon
Behavioral: Response latency simulation, decision biases, chain-of-thought reasoning patterns
Knowledge: short term, long term conversational memory, sense of self, awareness of relationships, awareness of the world, facts are limited to authenticity of the individual (not everyone is an astro-physicist)
Emotional: Valence/arousal Scores
Social: relationship graphs

Analyze media and documents for the following insights and add the insights to the avatar document for prompt injection and tuning. Maximally true-to-life authenticity is the objective.
audio tone-of-voice-inflection.

Inner Persona
Outer Persona
OCEAN persona metrics (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
use personahub... review Cambridge Analytica psychological profiles
capture metadata such as:
interests, hobbies, values (schwartz's basic human values: power, achievement, benevolence, etc.)
moral foundations (care, fiarness, loyalty, authority, sanctity, liberty), dark traits ( Machiavellianism, narcissism, psychopathy, sadism), political orientation, religious beliefs, emotional states, cognitive styles, decision-making patterns, cultural background, socioeconomic status, social network ties, motivations, attitudes toward risk


sometimes you read a passage and you hear a person's voice in your head. Sometimes you read a quote of something someone said and you can feel them. This is the abstraction of those experiences collected an d brought to a new dimension. 

