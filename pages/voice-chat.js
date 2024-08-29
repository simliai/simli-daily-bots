import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the VoiceClientWrapper with no SSR
const VoiceClientWrapper = dynamic(
  () => import('../components/VoiceClientWrapper'),
  { ssr: false }
);

export default function VoiceChat() {
  return (
    <div>
      <h1>Voice Chat Page</h1>
      <p>This page uses the VoiceClientWrapper component.</p>
      <VoiceClientWrapper>
        {/* Add any other components or UI elements for your voice chat here */}
        <div>Voice client has started</div>
      </VoiceClientWrapper>
    </div>
  );
}