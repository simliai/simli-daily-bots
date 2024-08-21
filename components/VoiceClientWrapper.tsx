import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SimliIntegratedVoiceClientAudioWrapper with no SSR
const SimliIntegratedVoiceClientAudioWrapper = dynamic(
  () => import('./SimliIntegratedVoiceClientAudioWrapper'),
  { ssr: false }
);

export default function VoiceClientWrapper({ children }) {
  const [voiceClient, setVoiceClient] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeVoiceClient = async () => {
      try {
        const { DailyVoiceClient } = await import('realtime-ai-daily');
        const { VoiceClientProvider } = await import('realtime-ai-react');

        const client = new DailyVoiceClient({
          baseUrl: "/api/dailybotApi",
          enableMic: true,
          enableCam: false,
          services: {
            tts: "cartesia",
            llm: "anthropic"
          },
          config: [
            {
              service: "tts",
              options: [
                {
                  name: "voice",
                  value: "79a125e8-cd45-4c13-8a67-188112f4dd22"
                }
              ]
            },
            {
              service: "llm",
              options: [
                {
                  name: "model",
                  value: "claude-3-5-sonnet-20240620"
                },
                {
                  name: "initial_messages",
                  value: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "You are Marie Curie, you do not speak verbosely."
                        }
                      ]
                    }
                  ]
                },
                {
                  name: "run_on_config",
                  value: true
                }
              ]
            }
          ],
          callbacks: {
            onBotReady: () => {
              console.log("Bot is ready!");
            },
          }
        });

        await client.start();
        setVoiceClient({ client, VoiceClientProvider });
      } catch (e) {
        console.error("Error initializing voice client:", e);
        setError(e.message || "Unknown error occurred");
      }
    };

    initializeVoiceClient();

    return () => {
      if (voiceClient && voiceClient.client) {
        voiceClient.client.stop();
      }
    };
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!voiceClient) {
    return <div>Loading voice client...</div>;
  }

  const { client, VoiceClientProvider } = voiceClient;

  return (
    <VoiceClientProvider voiceClient={client}>
      {children}
      <SimliIntegratedVoiceClientAudioWrapper />
    </VoiceClientProvider>
  );
}