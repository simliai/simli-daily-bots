import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Mic, MessageSquare, User } from 'lucide-react';

// Dynamically import the VoiceClientWrapper with no SSR
const VoiceClientWrapper = dynamic(
  () => import('../components/VoiceClientWrapper'),
  { ssr: false }
);

export default function VoiceChat() {
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  const startVoiceChat = () => {
    setIsVoiceChatActive(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-200 flex flex-col items-center justify-center p-4">
      <main className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-6 text-blue-600">Welcome to Simli Avatar Chat</h1>
        
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
              <Mic className="mr-2 text-blue-500" />
              Start Talking
            </h2>
            <p className="text-gray-600 mb-4">
              Click the button below to start your video call session.
            </p>
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-300"
              onClick={startVoiceChat}
              disabled={isVoiceChatActive}
            >
              {isVoiceChatActive ? 'Call started' : 'Start Avatar Call'}
            </button>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
              <MessageSquare className="mr-2 text-green-500" />
              Real-time Conversation
            </h2>
            <p className="text-gray-600">
              Engage in natural, flowing conversations with our AI. It understands context, nuance, and can assist with a wide range of topics.
            </p>
          </div>
        </div>

        {isVoiceChatActive && (
          <VoiceClientWrapper>
            <div className="mt-8 text-center text-green-600 font-semibold">
              Simli client is active. Start speaking!
            </div>
          </VoiceClientWrapper>
        )}
      </main>

      <footer className="mt-8 text-center text-gray-600">
        © 2024 Simli. All rights reserved.
      </footer>
    </div>
  );
}