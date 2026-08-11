import React from 'react';
import {
  Ear,
  EarOff,
  MessageCircle,
  Mic,
  Upload,
  Settings,
  ChevronDown,
  ChevronUp,
  Eye,
  Bluetooth,
  MousePointer2,
} from 'lucide-react';
import { TbBubble } from 'react-icons/tb';
import { GiRobotGolem } from 'react-icons/gi';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';

const DataExchangeDropdown = ({
  showDataExchangeDropdown,
  setShowDataExchangeDropdown,
  dropdownRef,
}) => {
  const { activeAvatar } = useAuth();

  const {
    messages,
    messagesEndRef,
    isTranscribing,
    startTranscription,
    stopTranscription,
    isThoughtToImageEnabled,
    startThoughtToImage,
    stopThoughtToImage,
    dataExchangeTypes,
    toggleDataExchangeType,
    fileInputRef,
    handleFileUpload,
  } = useMedia();

  return (
    <div ref={dropdownRef}>
      <div className="relative inline-block text-left">
        <button
          onClick={() => setShowDataExchangeDropdown((v) => !v)}
          className="transition-transform duration-300 hover:scale-105 px-4 py-2 rounded hover:bg-teal-600 transition-colors focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 rounded px-3 py-2 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center max-h-64 overflow-y-auto"
          aria-label="Toggle data exchange options"
        >
          {showDataExchangeDropdown ? (
            <ChevronDown className="w-6 h-6" />
          ) : (
            <ChevronUp className="w-6 h-6" />
          )}
        </button>
        <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
          Toggle options
        </span>
      </div>
      {showDataExchangeDropdown && (
        <div className="absolute bottom-20 left-0 bg-black/50 backdrop-blur-lg rounded-lg border border-white/20 p-2 flex flex-row gap-2 z-10">
          <div className="relative group">
            <button
              onClick={isTranscribing ? stopTranscription : startTranscription}
              className={
                isTranscribing
                  ? 'transition-transform duration-300 hover:scale-105 p-2 rounded transition-colors focus:outline focus:outline-2 bg-yellow-600 hover:bg-yellow-700'
                  : 'transition-transform duration-300 hover:scale-105 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center hover:bg-teal-600 focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900'
              }
              aria-label={
                isTranscribing ? 'Stop suggestions' : 'Start suggestions'
              }
              disabled={!dataExchangeTypes.voice}
            >
              {isTranscribing ? (
                <EarOff className="w-6 h-6" />
              ) : (
                <Ear className="w-6 h-6" />
              )}
              {/* {dataExchangeTypes.voice ? "Transcription On" : "Transcription Off"} */}
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {isTranscribing ? 'Stop suggestions' : 'Start suggestions'}
            </span>
          </div>
          {/* 
          <div className="relative group">
            <button
              onClick={() => toggleDataExchangeType("voice")}
              className={dataExchangeTypes.voice 
                ? "transition-transform duration-300 hover:scale-105 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center hover:bg-teal-600 focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900" 
                : "transition-transform duration-300 hover:scale-105 p-2 rounded transition-colors focus:outline focus:outline-2 bg-yellow-600 hover:bg-yellow-700"
              }
              aria-label={dataExchangeTypes.voice ? "Disable Voice Input" : "Enable Voice Input"}
            >
              <Mic className="w-6 h-6 inline-block mr-2" />
              // {dataExchangeTypes.voice ? "Voice On" : "Voice Off"} 
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {dataExchangeTypes.voice ? "Enable Voice Input" : "Disable Voice Input"}
            </span>
          </div>  

          <div className="relative group">
            <button
              onClick={() => toggleDataExchangeType('text')}
              className={
                dataExchangeTypes.text
                  ? 'transition-transform duration-300 hover:scale-105 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center hover:bg-teal-600 focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900'
                  : 'transition-transform duration-300 hover:scale-105 p-2 rounded transition-colors focus:outline focus:outline-2 bg-yellow-600 hover:bg-yellow-700'
              }
              aria-label={
                dataExchangeTypes.text
                  ? 'Enable Thought-To-Text Input'
                  : 'Disable Thought-To-Text Input'
              }
            >
              // <ThoughtBubble  className="w-6 h-6 inline-block mr-2" /> 
              <TbBubble className="w-6 h-6 inline-block mr-2" />
              // </div>{dataExchangeTypes.text ? "Text On" : "Text Off"} 
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {dataExchangeTypes.text
                ? 'Enable Thought-To-Text Input'
                : 'Disable Thought-To-Text Input'}
            </span>
          </div>
*/}
          <div className="relative group">
            <button
              onClick={
                isThoughtToImageEnabled
                  ? stopThoughtToImage
                  : startThoughtToImage
              }
              className={
                isThoughtToImageEnabled
                  ? 'transition-transform duration-300 hover:scale-105 p-2 rounded transition-colors focus:outline focus:outline-2 bg-yellow-600 hover:bg-yellow-700'
                  : 'transition-transform duration-300 hover:scale-105 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center hover:bg-teal-600 focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900'
              }
              aria-label={
                isThoughtToImageEnabled
                  ? 'Disable Thought-To-Image Input'
                  : 'Enable Thought-To-Image Input'
              }
              disabled={!dataExchangeTypes.neuralImage}
            >
              <Eye className="w-6 h-6 inline-block mr-2" />
              {/* {dataExchangeTypes.custom ? 'Custom On' : 'Custom Off'} */}
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20`0">
              {isThoughtToImageEnabled
                ? 'Disable Thought-To-Image Input'
                : 'Enable Thought-To-Image Input'}
            </span>
          </div>
          {/* 
          <div className="relative group">
            <button
              onClick={() => toggleDataExchangeType('neuralMotion')}
              className={
                dataExchangeTypes.neuralMotion
                  ? 'transition-transform duration-300 hover:scale-105 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center hover:bg-teal-600 focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900'
                  : 'transition-transform duration-300 hover:scale-105 p-2 rounded transition-colors focus:outline focus:outline-2 bg-yellow-600 hover:bg-yellow-700'
              }
              aria-label={
                dataExchangeTypes.neuralMotion
                  ? 'Enable Motion Input'
                  : 'Disable Motion Input'
              }
            >
              <GiRobotGolem className="w-6 h-6 inline-block mr-2" />
              // {dataExchangeTypes.voice ? 'Voice On' : 'Voice Off'}
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {dataExchangeTypes.neuralMotion
                ? 'Enable Thought-to-Motion Input'
                : 'Disable Thought-to-Motion Input'}
            </span>
          </div>
          
          <div className="relative group">
            <button
              onClick={() => toggleDataExchangeType('telepathy')}
              className={
                dataExchangeTypes.telepathy
                  ? 'transition-transform duration-300 hover:scale-105 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center hover:bg-teal-600 focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900'
                  : 'transition-transform duration-300 hover:scale-105 p-2 rounded transition-colors focus:outline focus:outline-2 bg-yellow-600 hover:bg-yellow-700'
              }
              aria-label={
                dataExchangeTypes.telepathy
                  ? 'Enable Telepathy'
                  : 'Disable Telepathy'
              }
            >
              <MousePointer2 className="w-6 h-6 inline-block mr-2" />
              //  {dataExchangeTypes.voice ? "Voice On" : "Voice Off"} 
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {dataExchangeTypes.telepathy
                ? 'Enable Telepathy'
                : 'Disable Telepathy'}
            </span>
          </div>

          <div className="relative group">
            <button
              onClick={() => toggleDataExchangeType('bluetoothControl')}
              className={
                'transition-transform duration-300 hover:scale-105 px-4 py-2 rounded hover:bg-teal-600 transition-colors focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 rounded px-3 py-2 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center'
              }
              aria-label={
                dataExchangeTypes.bluetoothControl
                  ? 'Discover & Control Bluetooth Devices'
                  : 'Discover & Control Bluetooth Devices'
              }
            >
              <Bluetooth className="w-6 h-6 inline-block mr-2" />
              // {dataExchangeTypes.voice ? "Voice On" : "Voice Off"} 
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {dataExchangeTypes.bluetoothControl
                ? 'Discover & Control Bluetooth Devices'
                : 'Discover & Control Bluetooth Devices'}
            </span>
          </div>
 */}
          {/* <div className="relative group">
            <button
              onClick={() => {
                toggleDataExchangeType('fileUpload');
                if (dataExchangeTypes.fileUpload) {
                  fileInputRef.current && fileInputRef.current.click();
                }
              }}
              className={
                'transition-transform duration-300 hover:scale-105 px-4 py-2 rounded hover:bg-teal-600 transition-colors focus:outline focus:outline-2 focus:outline-teal-400 min-w-0 rounded px-3 py-2 border border-gray-700 text-white bg-black/35 from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-900 px-6 py-3 rounded-xl flex font-semibold gap-2 transition-all duration-300 transform shadow-lg items-center justify-center'
              }
              aria-label={
                dataExchangeTypes.fileUpload ? 'File Upload' : 'File Upload'
              }
            >
              <Upload className="w-6 h-6 inline-block mr-2" />
   
            </button>
            <span className="absolute hidden group-hover:block -top-10 left-1/2 transform -translate-x-1/2 bg-black/75 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
              {dataExchangeTypes.fileUpload ? 'File Upload' : 'File Upload'}
            </span>
          </div> */}
        </div>
      )}
    </div>
  );
};

export default DataExchangeDropdown;
