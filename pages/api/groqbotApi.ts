import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { services, config } = req.body;

      const payload = {
        bot_profile: "voice_2024_08",
        api_keys: { groq: "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" },
        max_duration: 300,
        services,
        config,
      };

      const response = await fetch("https://api.daily.co/v1/bots/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const botData = await response.json();
      return res.status(200).json(botData);
    } catch (error) {
      console.error("Error starting bot:", error);
      return res.status(500).json({ error: "Failed to start bot" });
    }
  } else {
    // Handle any non-POST requests
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}