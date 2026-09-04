# bugs

## Avatar Settings
non personal avatars do not use recordings from a person (they accept uploaded media for that will be used as reference audio as well)

Generate button should be of the description that is optional to press to generate a description from the avatar (message avatar to describe themselves); implements the avatar's own knowledge of their identity using their uploaded data;
Generate button should not be of the reference images; 

if the first and final frames of the reference videos (7 base emotions) do not match on loop, play the video in reverse;

there is no conversation pin message thread nor delete message thread
there is no user message edit or copy (edit, accept/cancel edit, re-send edit)
there is no conversation share message thread (shares conversation with others; does not allow the conversation to be continued; only shows the message window as if sharing the anonymous chat;)

there should be conversation suggestions that are populated from the avatar given the context of the conversation that exist in clickable bubbles in the message area

there is no enable webcam feature on voice chat mode; there is no share screen for voice chat mode

there is no rating for the avatar message or feedback to send
there are no metrics for each avatar response (see /f-Neural-Nexus-Fronend/langchain_example_chat.png)
the voice mode image/video is too close (should be framed)

when there is no avatar reference audio, clicking the toast should not dismiss the toast but rather route to avatar settings (there should be a button to dismiss the toast on the right and clicking on the left should route to the avatar settings) (similar to this tailwind css yet the left side is a clickable route to the avatar settings: toast.custom((t) => (
  <div
    className={`${
      t.visible ? 'animate-custom-enter' : 'animate-custom-leave'
    } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
  >
    <div className="flex-1 w-0 p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          <img
            className="h-10 w-10 rounded-full"
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixqx=6GHAjsWpt9&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.2&w=160&h=160&q=80"
            alt=""
          />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">
            Emilia Gates
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Sure! 8:30pm works great!
          </p>
        </div>
      </div>
    </div>
    <div className="flex border-l border-gray-200">
      <button
        onClick={() => toast.dismiss(t.id)}
        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Close
      </button>
    </div>
  </div>
)))

The MCP status indicator button should be removed in avatar settings
clicking the avatar desktop mcp connect button should allow for the connection to the mcp server if available
the MCP text is not completely show on the card
adding MCP connections to difference devices should populate those new devices within connectors with appropriate metadata
should be able to cancel any description generation

should not attempt to connect to ubuntu pc "on next turn" needs to attempt to connect immediately

