import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Volume2, VolumeX, SignalHigh, SignalMedium, SignalLow, SignalZero } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Call } from '../types';
import { startRinging, stopRinging } from '../lib/notificationSound';

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
  useBodyScrollLock(!!activeCall || !!incomingCall);

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

  // Each call starts unmuted with camera and speaker on; don't carry the last call's toggles over.
  React.useEffect(() => {
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSpeakerOn(true);
  }, [localStream]);

  // Ring while a call is waiting to be answered in the open chat (respects the mute preference).
  const incomingCallId = incomingCall?.id;
  React.useEffect(() => {
    if (!incomingCallId) return;
    startRinging();
    return () => stopRinging();
  }, [incomingCallId]);

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
          key="active-or-incoming-call-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70"
        >
          {incomingCall ? (
            <div className="bg-white rounded-xl border border-stone-200 p-6 sm:p-8 max-w-sm w-full shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-stone-100 text-stone-700 rounded-full flex items-center justify-center mb-5">
                {incomingCall.type === 'video' ? <Video size={32} /> : <Phone size={32} />}
              </div>
              <h3 className="tm-h2 mb-1">
                Incoming call
              </h3>
              <p className="tm-muted mb-6 break-words">
                {incomingCall.callerName} is calling
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => onReject(incomingCall)}
                  className="tm-btn tm-btn-danger flex-1"
                >
                  <PhoneOff size={20} />
                  Decline
                </button>
                <button
                  onClick={() => onAnswer(incomingCall)}
                  className="tm-btn flex-1 bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  {incomingCall.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
                  Accept
                </button>
              </div>
            </div>
          ) : activeCall ? (
            <div className="relative w-full max-w-4xl aspect-video bg-stone-900 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
              {/* Network Quality Indicator */}
              {activeCall.status === 'connected' && networkQuality !== 'unknown' && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-stone-900/70 rounded-lg border border-stone-700/50">
                  {networkQuality === 'excellent' && <SignalHigh size={16} className="text-stone-100" />}
                  {networkQuality === 'good' && <SignalMedium size={16} className="text-stone-200" />}
                  {networkQuality === 'fair' && <SignalLow size={16} className="text-amber-300" />}
                  {networkQuality === 'poor' && <SignalZero size={16} className="text-red-400" />}
                  <span className="text-xs font-medium text-white capitalize">{networkQuality} connection</span>
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
                  <div className="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center mb-4">
                    <Phone size={36} className="text-stone-300" />
                  </div>
                  <h3 className="text-xl font-medium">{activeCall.status === 'ringing' ? 'Ringing' : 'Connected'}</h3>
                </div>
              )}

              {/* Local Video */}
              {activeCall.type === 'video' && (
                <div className="absolute top-4 right-4 w-28 sm:w-48 aspect-video bg-stone-800 rounded-lg overflow-hidden shadow-sm border border-stone-700">
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
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-stone-900/85 rounded-xl border border-stone-700">
                <button
                  onClick={toggleSpeaker}
                  className={`p-3 rounded-full transition-colors ${
                    !isSpeakerOn ? 'bg-red-600 text-white' : 'bg-stone-700 text-white hover:bg-stone-600'
                  }`}
                  title={isSpeakerOn ? "Mute audio" : "Unmute audio"}
                >
                  {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full transition-colors ${
                    isMuted ? 'bg-red-600 text-white' : 'bg-stone-700 text-white hover:bg-stone-600'
                  }`}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                {activeCall.type === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${
                      isVideoOff ? 'bg-red-600 text-white' : 'bg-stone-700 text-white hover:bg-stone-600'
                    }`}
                    title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                  >
                    {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
                  </button>
                )}
                <button
                  onClick={onEndCall}
                  className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
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
