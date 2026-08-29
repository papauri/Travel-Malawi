import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Volume2, VolumeX, SignalHigh, SignalMedium, SignalLow, SignalZero } from 'lucide-react';
import { Call } from '../types';

interface CallModalProps {
  activeCall: Call | null;
  incomingCall: Call | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onAnswer: (call: Call) => void;
  onReject: (call: Call) => void;
  onEndCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  networkQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export function CallModal({
  activeCall,
  incomingCall,
  localVideoRef,
  remoteVideoRef,
  onAnswer,
  onReject,
  onEndCall,
  localStream,
  remoteStream,
  networkQuality = 'unknown'
}: CallModalProps) {
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = React.useState(true);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerOn;
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall]);

  React.useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
    }
  }, [remoteStream, activeCall]);

  return (
    <AnimatePresence>
      {(activeCall || incomingCall) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          {incomingCall ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                {incomingCall.type === 'video' ? <Video size={32} /> : <Phone size={32} />}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Incoming Call
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                {incomingCall.callerName} is calling...
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => onReject(incomingCall)}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneOff size={20} />
                  Decline
                </button>
                <button
                  onClick={() => onAnswer(incomingCall)}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  {incomingCall.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
                  Accept
                </button>
              </div>
            </div>
          ) : activeCall ? (
            <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Network Quality Indicator */}
              {activeCall.status === 'connected' && networkQuality !== 'unknown' && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 backdrop-blur-md rounded-full border border-gray-700/50">
                  {networkQuality === 'excellent' && <SignalHigh size={16} className="text-green-400" />}
                  {networkQuality === 'good' && <SignalMedium size={16} className="text-emerald-400" />}
                  {networkQuality === 'fair' && <SignalLow size={16} className="text-yellow-400" />}
                  {networkQuality === 'poor' && <SignalZero size={16} className="text-red-500" />}
                  <span className="text-xs font-medium text-white capitalize">{networkQuality} Connection</span>
                </div>
              )}

              {/* Remote Media (Always rendered to ensure audio plays) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${activeCall.type === 'audio' ? 'opacity-0 absolute inset-0 -z-10 pointer-events-none' : ''}`}
              />
              
              {activeCall.type === 'audio' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <Phone size={40} className="text-gray-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-medium">{activeCall.status === 'ringing' ? 'Ringing...' : 'Connected'}</h3>
                </div>
              )}

              {/* Local Video */}
              {activeCall.type === 'video' && (
                <div className="absolute top-4 right-4 w-48 aspect-video bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-gray-700">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-gray-900/80 backdrop-blur-md rounded-full border border-gray-700">
                <button
                  onClick={toggleSpeaker}
                  className={`p-3 rounded-full transition-colors ${
                    !isSpeakerOn ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                  title={isSpeakerOn ? "Mute audio" : "Unmute audio"}
                >
                  {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full transition-colors ${
                    isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                {activeCall.type === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${
                      isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                    title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                  >
                    {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
                  </button>
                )}
                <button
                  onClick={onEndCall}
                  className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="End call"
                >
                  <PhoneOff size={20} />
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
