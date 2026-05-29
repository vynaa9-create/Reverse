/**
 * 【 Codestral AI 】
 * Creator  : rhmt
 * Base     : https://overchat(.)ai/
 * Category : AI Chat
 * Desc     : Codestral ai, Chat AI stream via Overchat endpoin
 * Channel  :  https://whatsapp.com/channel/0029VbBjyjlJ93wa6hwSWa0p
 * Note : model frontend bisa beda sama backend 🗿
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";

const API = "https://api.overchat.ai/v1/chat/completions";
const SESSION_FILE = "./overchat-session.json";

async function loadSession() {
  try {
    return JSON.parse(await fs.readFile(SESSION_FILE, "utf8"));
  } catch {
    return {
      chatId: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      messages: [],
    };
  }
}

async function saveSession(session) {
  await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2));
}

async function overchat(prompt, options = {}) {
  try {
    if (!prompt) {
      return {
        status: false,
        code: 400,
        creator: "rhmt",
        error: "Prompt kosong",
      };
    }

    const session = await loadSession();

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    const systemMessage = {
      id: crypto.randomUUID(),
      role: "system",
      content: options.system || "",
    };

    const messages = [
      ...session.messages,
      userMessage,
      systemMessage,
    ];

    const body = {
      chatId: session.chatId,
      model: options.model || "openai/gpt-4o",
      messages,
      personaId: options.personaId || "gpt-4o-landing",
      frequency_penalty: 0,
      max_tokens: options.max_tokens || 4000,
      presence_penalty: 0,
      stream: true,
      temperature: options.temperature ?? 0.5,
      top_p: options.top_p ?? 0.95,
    };

    const res = await fetch(API, {
      method: "POST",
      headers: {
        "sec-ch-ua-platform": `"Android"`,
        "x-device-uuid": session.deviceId,
        "x-device-language": "id-ID",
        "x-device-platform": "web",
        "x-device-version": "1.0.44",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
        accept: "*/*",
        "content-type": "application/json",
        origin: "https://overchat.ai",
        referer: "https://overchat.ai/",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      return {
        status: false,
        code: res.status,
        creator: "rhmt",
        error: await res.text(),
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let temp = "";
    let answer = "";
    let responseId = null;
    let realModel = null;
    let provider = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      temp += decoder.decode(value, { stream: true });

      const lines = temp.split("\n");
      temp = lines.pop() || "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);

          if (json.id) responseId = json.id;
          if (json.model) realModel = json.model;
          if (json.provider) provider = json.provider;

          const text = json.choices?.[0]?.delta?.content;
          if (typeof text === "string") answer += text;
        } catch {}
      }
    }

    session.messages.push(userMessage);
    session.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: answer,
    });

    await saveSession(session);

    return {
      status: true,
      code: res.status,
      creator: "rhmt",
      chatId: session.chatId,
      deviceId: session.deviceId,
      responseId,
      requestedModel: body.model,
      realModel,
      provider,
      answer,
    };
  } catch (err) {
    return {
      status: false,
      code: 500,
      creator: "rhmt",
      error: err.message,
    };
  }
}

export default overchat;
export { overchat };

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const prompt = process.argv.slice(2).join(" ") || "Buat script python kalkulator sederhana";
  const result = await overchat(prompt);
  console.log(JSON.stringify(result, null, 2));
}
