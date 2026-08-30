import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db } from './firebase';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, 
  query, where, addDoc, getDocs, deleteDoc 
} from 'firebase/firestore';
import { Call, CallCandidate } from '../types';
import { usePermission } from '../contexts/PermissionContext';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export function useWebRTC(chatId: string, currentUserId: string, currentUserName: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  
  const { requestPermission } = usePermission();
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);

  // Listen for incoming calls
  useEffect(() => {
    if (!chatId || !currentUserId) return;
    
    const callsRef = collection(db, 'hotel_chats', chatId, 'calls');
    const q = query(
      callsRef, 
      where('calleeId', '==', currentUserId),
      where('status', '==', 'ringing')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const callData = { id: change.doc.id, ...change.doc.data() } as Call;
          setIncomingCall(callData);
        }
        if (change.type === 'modified') {
          const callData = change.doc.data() as Call;
          if (callData.status !== 'ringing') {
            setIncomingCall(null);
          }
        }
        if (change.type === 'removed') {
          setIncomingCall(null);
        }
      });
    });
    
    return () => unsubscribe();
  }, [chatId, currentUserId]);

  // Listen for call status changes (for caller)
  useEffect(() => {
    if (!chatId || !activeCall?.id) return;
    
    const callRef = doc(db, 'hotel_chats', chatId, 'calls', activeCall.id);
    const unsubscribe = onSnapshot(callRef, async (snapshot) => {
      const data = snapshot.data() as Call;
      if (!data) return;
      
      setActiveCall(prev => prev ? { ...prev, ...data } : null);
      
      // If callee answered, set remote description
      if (data.status === 'connected' && data.answer && peerConnection.current && peerConnection.current.signalingState !== 'stable') {
        try {
          const rtcSessionDescription = new RTCSessionDescription(data.answer);
          await peerConnection.current.setRemoteDescription(rtcSessionDescription);
          pendingCandidates.current.forEach(c => {
             peerConnection.current?.addIceCandidate(c).catch(e => console.error(e));
          });
          pendingCandidates.current = [];
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
      
      if (data.status === 'ended' || data.status === 'rejected') {
        cleanup();
      }
    });
    
    return () => unsubscribe();
  }, [chatId, activeCall?.id]);

  // Listen for remote ICE candidates
  useEffect(() => {
    if (!chatId || !activeCall?.id || !peerConnection.current) return;
    
    const isCaller = activeCall.callerId === currentUserId;
    const candidatesCollection = isCaller ? 'calleeCandidates' : 'callerCandidates';
    
    const candidatesRef = collection(db, 'hotel_chats', chatId, 'calls', activeCall.id, candidatesCollection);
    const unsubscribe = onSnapshot(candidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as CallCandidate;
          const candidate = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex
          });
          if (peerConnection.current?.remoteDescription) {
            peerConnection.current.addIceCandidate(candidate).catch(e => console.error('Error adding ice candidate:', e));
          } else {
            pendingCandidates.current.push(candidate);
          }
        }
      });
    });
    
    return () => unsubscribe();
  }, [chatId, activeCall?.id, currentUserId]);

  const setupMedia = async (video: boolean = true) => {
    try {
      toast('Please allow access to your camera and microphone for the call. You can safely deny this if you prefer text chat.', { 
        icon: '🛡️', 
        duration: 8000,
        id: 'media-permission' 
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      
      setError(err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast('Call cancelled. Camera/microphone access was denied. You can continue using text chat.', { icon: '💬' });
      } else {
        toast.error('Could not access camera/microphone. Please check your device settings.');
      }
      return null;
    }
  };

  const createPeerConnection = (callId: string, isCaller: boolean, stream: MediaStream) => {
    const pc = new RTCPeerConnection(configuration);
    peerConnection.current = pc;
    
    // Setup remote stream
    const rStream = new MediaStream();
    setRemoteStream(rStream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = rStream;
    }
    
    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    // Listen for remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          // Explicitly call play to handle some mobile browser constraints
          remoteVideoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
        }
        setRemoteStream(event.streams[0]);
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const collectionName = isCaller ? 'callerCandidates' : 'calleeCandidates';
        const candidatesRef = collection(db, 'hotel_chats', chatId, 'calls', callId, collectionName);
        addDoc(candidatesRef, {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          createdAt: Date.now()
        });
      }
    };
    
    return pc;
  };

  const startCall = async (calleeId: string, video: boolean = true) => {
    const stream = await setupMedia(video);
    if (!stream) return;
    
    const callRef = doc(collection(db, 'hotel_chats', chatId, 'calls'));
    const callId = callRef.id;
    
    const pc = createPeerConnection(callId, true, stream);
    
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    
    const callData: Call = {
      id: callId,
      chatId,
      callerId: currentUserId,
      callerName: currentUserName,
      calleeId,
      status: 'ringing',
      type: video ? 'video' : 'audio',
      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await setDoc(callRef, callData);
    setActiveCall(callData);
  };

  const answerCall = async (call: Call) => {
    setIncomingCall(null);
    const stream = await setupMedia(call.type === 'video');
    if (!stream) return;
    
    const pc = createPeerConnection(call.id!, false, stream);
    
    const offerDescription = new RTCSessionDescription(call.offer);
    await pc.setRemoteDescription(offerDescription);
    
    pendingCandidates.current.forEach(c => {
       pc.addIceCandidate(c).catch(e => console.error(e));
    });
    pendingCandidates.current = [];

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    
    const callRef = doc(db, 'hotel_chats', chatId, 'calls', call.id!);
    await updateDoc(callRef, {
      status: 'connected',
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp
      },
      updatedAt: Date.now(),
      connectedAt: Date.now()
    });
    
    setActiveCall({ ...call, status: 'connected', connectedAt: Date.now() });
  };

  const rejectCall = async (call: Call) => {
    setIncomingCall(null);
    const callRef = doc(db, 'hotel_chats', chatId, 'calls', call.id!);
    await updateDoc(callRef, {
      status: 'rejected',
      updatedAt: Date.now(),
      endedAt: Date.now()
    });
  };

  const endCall = async () => {
    if (activeCall?.id) {
      const callRef = doc(db, 'hotel_chats', chatId, 'calls', activeCall.id);
      await updateDoc(callRef, {
        status: 'ended',
        updatedAt: Date.now(),
        endedAt: Date.now()
      });
    }
    cleanup();
  };

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected' || !peerConnection.current) {
      setNetworkQuality('unknown');
      return;
    }

    const interval = setInterval(async () => {
      if (!peerConnection.current) return;
      try {
        const stats = await peerConnection.current.getStats();
        let maxRtt = 0;
        let packetsLost = 0;
        let packetsReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              maxRtt = Math.max(maxRtt, report.currentRoundTripTime * 1000);
            }
          }
          if (report.type === 'inbound-rtp') {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
        });

        let quality: NetworkQuality = 'excellent';
        const totalPackets = packetsLost + packetsReceived;
        const lossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;

        if (maxRtt > 300 || lossRate > 0.05) {
          quality = 'poor';
        } else if (maxRtt > 150 || lossRate > 0.02) {
          quality = 'fair';
        } else if (maxRtt > 0 || totalPackets > 0) {
          quality = 'good';
        } else {
          quality = 'excellent';
        }

        setNetworkQuality(quality);
      } catch (err) {
        console.warn('Error fetching WebRTC stats', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const cleanup = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    pendingCandidates.current = [];
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setNetworkQuality('unknown');
  };

  return {
    localVideoRef,
    remoteVideoRef,
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    error,
    networkQuality,
    startCall,
    answerCall,
    rejectCall,
    endCall
  };
}

