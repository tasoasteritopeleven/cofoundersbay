'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Phone } from 'lucide-react';
import { useVideoCallIntegration } from './useVideoCallIntegration';
import { VideoCallProvider } from './VideoCallProvider';

export function VideoCallDemo() {
  const { startCall, endCall, isCallActive } = useVideoCallIntegration();

  const handleStartCall = async () => {
    // In a real app, this would come from your backend
    const demoRoomUrl = 'https://your-domain.daily.co/room-123';
    await startCall(demoRoomUrl);
  };

  return (
    <VideoCallProvider>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Video Call Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Experience real-time video calls with Daily.co integration
            </p>
            
            <div className="flex gap-2 justify-center">
              {!isCallActive ? (
                <Button onClick={handleStartCall} className="gap-2">
                  <Video className="icon-sm" />
                  Start Demo Call
                </Button>
              ) : (
                <Button onClick={endCall} variant="destructive" className="gap-2">
                  <Phone className="icon-sm" />
                  End Call
                </Button>
              )}
            </div>
            
            {isCallActive && (
              <p className="text-xs text-status-success mt-2">
                Call is active - check for the video call window
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
    </VideoCallProvider>
  );
}
