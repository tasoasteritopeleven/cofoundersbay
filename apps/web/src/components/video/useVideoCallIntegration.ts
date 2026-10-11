'use client';

import { useState } from 'react';
import { useVideoCall } from './VideoCallProvider';

export function useVideoCallIntegration() {
  const { state, startCall, endCall } = useVideoCall();
  const [showCall, setShowCall] = useState(false);

  const isCallActive = state !== 'idle';

  const handleStartCall = async (roomUrl: string) => {
    await startCall(roomUrl);
    setShowCall(true);
  };

  const handleEndCall = () => {
    endCall();
    setShowCall(false);
  };

  return {
    startCall: handleStartCall,
    endCall: handleEndCall,
    isCallActive,
    showCall,
    setShowCall,
  };
}
