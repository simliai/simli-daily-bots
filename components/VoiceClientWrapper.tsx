import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { config } from "./config"; // Import the config

// Dynamically import SimliIntegratedVoiceClientAudioWrapper with no SSR
const SimliIntegratedVoiceClientAudioWrapper = dynamic(
  () => import("./SimliIntegratedVoiceClientAudioWrapper"),
  { ssr: false }
);

export default function VoiceClientWrapper({ children }) {
  const [voiceClient, setVoiceClient] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeVoiceClient = async () => {
      try {
        const { DailyVoiceClient } = await import("realtime-ai-daily");
        const { VoiceClientProvider } = await import("realtime-ai-react");

        const client = new DailyVoiceClient({
          baseUrl: "/api/dailybotApi",
          enableMic: true,
          enableCam: false,
          services: {
            tts: "cartesia",
            llm: "anthropic",
          },
          config: [
            {
              service: "vad",
              options: [
                {
                  name: "params",
                  value: {
                    stop_secs: 0.3,
                  },
                },
              ],
            },
            {
              service: "tts",
              options: [
                {
                  name: "voice",
                  value: config.voiceId,
                },
              ],
            },
            {
              service: "llm",
              options: [
                {
                  name: "model",
                  value: "claude-3-5-sonnet-20240620",
                },
                {
                  name: "initial_messages",
                  value: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: config.initialPrompt,
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "run_on_config",
                  value: true,
                },
              ],
            },
          ],
          callbacks: {
            onBotReady: () => {
              console.log("Bot is ready!");
            },
            onMetrics: (metrics) => {
              console.log("Metrics:", metrics);
            },
            onUserStartedSpeaking: () => {
              console.log(
                "User started speaking at: ",
                new Date().toLocaleTimeString()
              );
            },
            onUserStoppedSpeaking: () => {
              console.log(
                "User stopped speaking at: ",
                new Date().toLocaleTimeString()
              );
            },
          },
        });

        await client.start();
        setVoiceClient({ client, VoiceClientProvider });
      } catch (e) {
        console.error("Error initializing voice client:", e);
        setError(e.message || "Unknown error occurred");
      }
    };

    initializeVoiceClient();
    console.log("initial prompt", config.initialPrompt);

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
